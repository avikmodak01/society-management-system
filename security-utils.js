// Security Utilities
// Comprehensive security functions for the Society Management System

class SecurityUtils {
    constructor() {
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
    }

    // Password Hashing using Web Crypto API
    async hashPassword(password, salt = null) {
        try {
            // Generate salt if not provided
            if (!salt) {
                salt = crypto.getRandomValues(new Uint8Array(16));
            } else if (typeof salt === 'string') {
                salt = this.hexToUint8Array(salt);
            }

            // Convert password to ArrayBuffer
            const passwordBuffer = this.encoder.encode(password);
            
            // Combine password and salt
            const combined = new Uint8Array(passwordBuffer.length + salt.length);
            combined.set(passwordBuffer);
            combined.set(salt, passwordBuffer.length);

            // Hash using PBKDF2
            const key = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                'PBKDF2',
                false,
                ['deriveBits']
            );

            const hashBuffer = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000, // Strong iteration count
                    hash: 'SHA-256'
                },
                key,
                256 // 32 bytes
            );

            const hashArray = new Uint8Array(hashBuffer);
            const saltHex = this.uint8ArrayToHex(salt);
            const hashHex = this.uint8ArrayToHex(hashArray);

            // Return salt:hash format
            return `${saltHex}:${hashHex}`;

        } catch (error) {
            console.error('Password hashing failed:', error);
            throw new Error('Password hashing failed');
        }
    }

    // Verify password against hash
    async verifyPassword(password, storedHash) {
        try {
            if (!storedHash || !storedHash.includes(':')) {
                // Handle legacy plain text passwords (temporary backward compatibility)
                console.warn('Legacy password format detected');
                return password === storedHash;
            }

            const [saltHex, hashHex] = storedHash.split(':');
            const salt = this.hexToUint8Array(saltHex);
            
            // Hash the provided password with the stored salt
            const newHash = await this.hashPassword(password, salt);
            const [, newHashHex] = newHash.split(':');
            
            // Constant-time comparison
            return this.constantTimeCompare(hashHex, newHashHex);

        } catch (error) {
            console.error('Password verification failed:', error);
            return false;
        }
    }

    // Constant-time string comparison to prevent timing attacks
    constantTimeCompare(a, b) {
        if (a.length !== b.length) return false;
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }

    // Utility functions
    uint8ArrayToHex(array) {
        return Array.from(array)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    hexToUint8Array(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    // Input Sanitization
    sanitizeInput(input, type = 'text') {
        if (typeof input !== 'string') return '';
        
        // Basic XSS prevention
        input = input.trim();
        
        switch (type) {
            case 'email':
                return input.toLowerCase()
                    .replace(/[^a-zA-Z0-9@._-]/g, '')
                    .substring(0, 254); // Email length limit
                    
            case 'phone':
                return input.replace(/[^0-9+()-\s]/g, '')
                    .substring(0, 20);
                    
            case 'amount':
                return input.replace(/[^0-9.-]/g, '')
                    .substring(0, 15);
                    
            case 'pin':
                return input.replace(/[^0-9]/g, '')
                    .substring(0, 4);
                    
            case 'memberId':
                return input.replace(/[^0-9]/g, '')
                    .substring(0, 10);
                    
            case 'name':
                return input.replace(/[<>\"'&{}]/g, '')
                    .substring(0, 100);
                    
            default:
                // General text sanitization
                return input.replace(/[<>\"'&]/g, '')
                    .substring(0, 1000);
        }
    }

    // Validate financial data
    validateFinancialData(data) {
        const errors = [];
        
        if (!data.amount || isNaN(data.amount) || data.amount <= 0) {
            errors.push('Invalid amount');
        }
        
        if (data.amount && data.amount > 10000000) { // 1 crore limit
            errors.push('Amount exceeds maximum limit');
        }
        
        if (!data.memberId || !/^\d+$/.test(data.memberId)) {
            errors.push('Invalid member ID');
        }
        
        return { isValid: errors.length === 0, errors };
    }

    // Generate secure random string
    generateSecureToken(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return this.uint8ArrayToHex(array);
    }

    // CSRF Token generation
    generateCSRFToken() {
        return this.generateSecureToken(16);
    }

    // Session security
    encryptSessionData(data, key) {
        // Simple encryption for demo - in production use proper encryption
        try {
            const jsonString = JSON.stringify(data);
            return btoa(jsonString);
        } catch (error) {
            console.error('Session encryption failed:', error);
            return null;
        }
    }

    decryptSessionData(encryptedData) {
        try {
            const jsonString = atob(encryptedData);
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('Session decryption failed:', error);
            return null;
        }
    }

    // Rate limiting helper
    createRateLimiter(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
        const attempts = new Map();
        
        return (identifier) => {
            const now = Date.now();
            const windowStart = now - windowMs;
            
            // Clean old attempts
            for (const [key, timestamps] of attempts.entries()) {
                attempts.set(key, timestamps.filter(time => time > windowStart));
                if (attempts.get(key).length === 0) {
                    attempts.delete(key);
                }
            }
            
            // Check current attempts
            const userAttempts = attempts.get(identifier) || [];
            if (userAttempts.length >= maxAttempts) {
                return { allowed: false, resetTime: Math.min(...userAttempts) + windowMs };
            }
            
            // Record this attempt
            userAttempts.push(now);
            attempts.set(identifier, userAttempts);
            
            return { allowed: true, remaining: maxAttempts - userAttempts.length };
        };
    }

    // DOM Security
    createSecureElement(tagName, textContent = '', attributes = {}) {
        const element = document.createElement(tagName);
        
        // Set text content safely
        if (textContent) {
            element.textContent = textContent;
        }
        
        // Set attributes safely
        for (const [key, value] of Object.entries(attributes)) {
            if (typeof value === 'string' && value.length > 0) {
                element.setAttribute(key, this.sanitizeInput(value));
            }
        }
        
        return element;
    }

    // Secure form validation
    validateForm(formData, rules) {
        const errors = {};
        
        for (const [field, value] of Object.entries(formData)) {
            const rule = rules[field];
            if (!rule) continue;
            
            // Required field check
            if (rule.required && (!value || value.trim() === '')) {
                errors[field] = 'This field is required';
                continue;
            }
            
            // Type validation
            if (value && rule.type) {
                const sanitized = this.sanitizeInput(value, rule.type);
                if (sanitized !== value) {
                    errors[field] = 'Invalid characters detected';
                    continue;
                }
                
                // Additional type-specific validation
                if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
                    errors[field] = 'Invalid email format';
                }
                
                if (rule.type === 'phone' && !/^\+?[\d\s()-]{10,}$/.test(sanitized)) {
                    errors[field] = 'Invalid phone number';
                }
                
                if (rule.type === 'amount') {
                    const amount = parseFloat(sanitized);
                    if (isNaN(amount) || amount <= 0) {
                        errors[field] = 'Invalid amount';
                    }
                }
            }
            
            // Length validation
            if (value && rule.minLength && value.length < rule.minLength) {
                errors[field] = `Minimum length is ${rule.minLength}`;
            }
            
            if (value && rule.maxLength && value.length > rule.maxLength) {
                errors[field] = `Maximum length is ${rule.maxLength}`;
            }
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}

// Global security utilities instance
window.SecurityUtils = new SecurityUtils();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityUtils;
}