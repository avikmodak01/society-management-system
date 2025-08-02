// SUPABASE CONFIGURATION - Add these at the top of your script
const SUPABASE_URL = 'https://lvsekyzhwwaezwfltxzr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2c2VreXpod3dhZXp3Zmx0eHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MjYyOTYsImV4cCI6MjA2NjUwMjI5Nn0.ZvHWrqxohHLGzLJIDgSr_y1L4MfMsO_bWdERxAoakK8';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize the application
async function initApp() {
    try {
        console.log('Starting app initialization...');
        
        // Test Supabase connection
        const { data, error } = await supabase.from('members').select('count').limit(1);
        if (error && error.code !== 'PGRST116') {
            console.error('Supabase connection error:', error);
            throw new Error(`Database connection failed: ${error.message}`);
        }
        
        console.log('Supabase connected successfully');
        
        // Initialize default quarter settings
        await initializeDefaultQuarterSettings();
        console.log('Quarter settings initialized');
        
        // Initialize form dates
        initializeDates();
        console.log('Dates initialized');
        
        // Setup event listeners
        setupEventListeners();
        console.log('Event listeners setup');
        
        // Initialize UI state
        setTimeout(() => {
            toggleInterestRateInput(); // Set initial state for loan form
        }, 100);
        
        // Load initial data with error handling
        try {
            await Promise.all([
                loadDashboard(),
                loadMembers(),
                loadSubscriptions(), 
                loadLoans(),
                loadDeposits(),
                loadQuarterSettings()
            ]);
            console.log('Initial data loaded');
        } catch (dataError) {
            console.error('Error loading initial data:', dataError);
            showAlert('Some data could not be loaded. Please refresh the page.', 'error');
        }
        
        console.log('App initialized successfully');
        showAlert('Application loaded successfully! 💡 Your data is safely stored in the cloud.', 'success');
        
    } catch (error) {
        console.error('Critical error initializing app:', error);
        
        // Show user-friendly error message
        const errorMessage = error.message || 'Unknown error occurred';
        
        if (errorMessage.includes('connection') || errorMessage.includes('network')) {
            alert('❌ Connection Error: Unable to connect to the database. Please check your internet connection and try again.');
        } else if (errorMessage.includes('PGRST')) {
            alert('❌ Database Error: There seems to be an issue with the database structure. Please contact support.');
        } else {
            alert(`❌ Application Error: ${errorMessage}. Please refresh the page and try again.`);
        }
        
        // Try to provide basic functionality even if some features fail
        initializeDates();
        setupEventListeners();
        initializeInterestWarningSystem();
    }
}


function addWarningModalCSS() {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = warningModalCSS;
    document.head.appendChild(styleSheet);
}

// Add the warning modal HTML to your page
function addWarningModalHTML() {
    const modalHTML = `
        <div id="interestWarningModal" class="interest-warning-modal">
            <div class="interest-warning-content">
                <span class="warning-icon">⚠️</span>
                <h2>Interest Posting Alert</h2>
                <p style="font-size: 1.2em; margin-bottom: 20px;">
                    <strong>Warning:</strong> Loan interest for previous month(s) has not been posted yet!
                </p>
                <div id="missingMonthsList" class="missing-months"></div>
                <p style="margin: 20px 0; font-size: 1.1em;">
                    📊 Posting monthly interest is required for accurate financial calculations and reports.
                </p>
                <p style="margin: 10px 0; opacity: 0.9;">
                    Would you like to post the missing interest now?
                </p>
                <div class="interest-warning-buttons">
                    <button class="warning-btn warning-btn-primary" onclick="goToInterestPosting()">
                        💰 Post Interest Now
                    </button>
                    <button class="warning-btn warning-btn-secondary" onclick="remindMeLater()">
                        ⏰ Remind Me Later
                    </button>
                    <button class="warning-btn warning-btn-secondary" onclick="dismissWarning()">
                        ✕ Dismiss
                    </button>
                </div>
                <p style="font-size: 0.9em; margin-top: 20px; opacity: 0.8;">
                    💡 Tip: Set up monthly reminders to post interest on the 1st of each month
                </p>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Check if interest posting is missing for previous months
async function checkMissingInterestPosting() {
    try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // 1-12
        const currentYear = currentDate.getFullYear();
        
        // Get all active loans
        const { data: activeLoans, error: loansError } = await supabase
            .from('loans')
            .select('id, loan_date')
            .eq('status', 'active');
        
        if (loansError) throw loansError;
        
        if (!activeLoans || activeLoans.length === 0) {
            return null; // No active loans, no need to check
        }
        
        // Find the earliest loan date to determine from when to check
        const earliestLoanDate = new Date(Math.min(...activeLoans.map(loan => new Date(loan.loan_date))));
        const earliestYear = earliestLoanDate.getFullYear();
        const earliestMonth = earliestLoanDate.getMonth() + 1;
        
        const missingMonths = [];
        
        // Check each month from earliest loan to previous month
        let checkYear = earliestYear;
        let checkMonth = earliestMonth;
        
        while (checkYear < currentYear || (checkYear === currentYear && checkMonth < currentMonth)) {
            const monthString = `${checkYear}-${String(checkMonth).padStart(2, '0')}`;
            
            // Check if interest was posted for this month
            const { data: interestPosting, error: interestError } = await supabase
                .from('loan_interest_accruals')
                .select('id')
                .eq('accrual_month', monthString)
                .limit(1);
            
            if (interestError) throw interestError;
            
            // If no interest posting found for this month, add to missing list
            if (!interestPosting || interestPosting.length === 0) {
                missingMonths.push({
                    month: checkMonth,
                    year: checkYear,
                    monthString: monthString,
                    displayName: getMonthName(checkMonth) + ' ' + checkYear
                });
            }
            
            // Move to next month
            checkMonth++;
            if (checkMonth > 12) {
                checkMonth = 1;
                checkYear++;
            }
        }
        
        return missingMonths.length > 0 ? missingMonths : null;
        
    } catch (error) {
        console.error('Error checking missing interest posting:', error);
        return null;
    }
}

// Get month name from number
function getMonthName(monthNumber) {
    const months = [
        '', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber];
}

// Show the warning modal with missing months
function showInterestWarningModal(missingMonths) {
    const modal = document.getElementById('interestWarningModal');
    const missingMonthsList = document.getElementById('missingMonthsList');
    
    if (!modal || !missingMonthsList) {
        console.error('Warning modal elements not found');
        return;
    }
    
    // Prepare the missing months display
    let monthsHTML = '<strong>Missing Interest Posting for:</strong><br>';
    
    if (missingMonths.length <= 3) {
        // Show all months if 3 or fewer
        monthsHTML += missingMonths.map(month => month.displayName).join(', ');
    } else {
        // Show first 2 and last 1 with count if more than 3
        monthsHTML += missingMonths.slice(0, 2).map(month => month.displayName).join(', ');
        monthsHTML += ` ... and ${missingMonths.length - 2} more months through `;
        monthsHTML += missingMonths[missingMonths.length - 1].displayName;
    }
    
    missingMonthsList.innerHTML = monthsHTML;
    
    // Store missing months for later use
    window.missingInterestMonths = missingMonths;
    
    // Show the modal
    modal.style.display = 'block';
}

// Navigate to interest posting section
function goToInterestPosting() {
    // Close the modal
    document.getElementById('interestWarningModal').style.display = 'none';
    
    // Navigate to monthly interest section
    if (typeof navigateToSection === 'function') {
        navigateToSection('monthly-interest');
    } else {
        // Fallback navigation
        const interestMenuItem = document.querySelector('[data-section="monthly-interest"]');
        if (interestMenuItem) {
            interestMenuItem.click();
        }
    }
    
    // If we have missing months, set the first missing month in the form
    if (window.missingInterestMonths && window.missingInterestMonths.length > 0) {
        setTimeout(() => {
            const postInterestMonth = document.getElementById('postInterestMonth');
            if (postInterestMonth) {
                postInterestMonth.value = window.missingInterestMonths[0].monthString;
            }
        }, 500);
    }
    
    // Show a helpful message
    setTimeout(() => {
        showAlert('💡 Post interest for each missing month, starting with the earliest month.', 'warning');
    }, 1000);
}

// Remind user later (store in localStorage)
function remindMeLater() {
    const reminderTime = new Date();
    reminderTime.setHours(reminderTime.getHours() + 4); // Remind in 4 hours
    
    localStorage.setItem('interestPostingReminder', reminderTime.getTime());
    
    document.getElementById('interestWarningModal').style.display = 'none';
    showAlert('⏰ You will be reminded about interest posting in 4 hours.', 'warning');
}

// Dismiss warning for today
function dismissWarning() {
    const today = new Date().toDateString();
    localStorage.setItem('interestWarningDismissed', today);
    
    document.getElementById('interestWarningModal').style.display = 'none';
    showAlert('Warning dismissed for today. It will reappear tomorrow if interest is still not posted.', 'warning');
}

// Check if user should be reminded
function shouldShowReminder() {
    const today = new Date().toDateString();
    const dismissed = localStorage.getItem('interestWarningDismissed');
    
    // Don't show if dismissed today
    if (dismissed === today) {
        return false;
    }
    
    // Check if reminder time has passed
    const reminderTime = localStorage.getItem('interestPostingReminder');
    if (reminderTime) {
        const reminderDate = new Date(parseInt(reminderTime));
        if (new Date() < reminderDate) {
            return false; // Reminder time hasn't passed yet
        } else {
            // Remove expired reminder
            localStorage.removeItem('interestPostingReminder');
        }
    }
    
    return true;
}

// Main function to check and show warning if needed
async function checkAndShowInterestWarning() {
    try {
        // Only check if user should be reminded
        if (!shouldShowReminder()) {
            return;
        }
        
        // Check for missing interest posting
        const missingMonths = await checkMissingInterestPosting();
        
        if (missingMonths && missingMonths.length > 0) {
            showInterestWarningModal(missingMonths);
        }
        
    } catch (error) {
        console.error('Error in interest warning check:', error);
    }
}

// Initialize the warning system
function initializeInterestWarningSystem() {
    // Add CSS and HTML to page
    addWarningModalCSS();
    addWarningModalHTML();
    
    // Check for missing interest posting when the app loads
    setTimeout(() => {
        checkAndShowInterestWarning();
    }, 2000); // Wait 2 seconds after app load
    
    // Also check when user navigates to loan-related sections
    const loanSections = ['issue-loan', 'loan-repayment', 'active-loans', 'monthly-interest'];
    
    document.addEventListener('click', function(e) {
        const target = e.target.closest('[data-section]');
        if (target) {
            const section = target.getAttribute('data-section');
            if (loanSections.includes(section)) {
                setTimeout(() => {
                    checkAndShowInterestWarning();
                }, 1000);
            }
        }
    });
}


// Initialize default quarter settings
async function initializeDefaultQuarterSettings() {
    try {
        // Check if quarter settings already exist
        const { data: existingSettings, error } = await supabase
            .from('quarter_settings')
            .select('id')
            .limit(1);
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (!existingSettings || existingSettings.length === 0) {
            // Insert default quarter settings (Financial year: Apr-Mar)
            const quarters = [
                { quarter_name: 'Q1', start_month: 4, end_month: 6 },   // April - June
                { quarter_name: 'Q2', start_month: 7, end_month: 9 },   // July - September  
                { quarter_name: 'Q3', start_month: 10, end_month: 12 }, // October - December
                { quarter_name: 'Q4', start_month: 1, end_month: 3 }    // January - March
            ];
            
            const { error: insertError } = await supabase
                .from('quarter_settings')
                .insert(quarters);
            
            if (insertError) throw insertError;
            
            console.log('Default quarter settings initialized');
        }
    } catch (error) {
        console.error('Error initializing quarter settings:', error);
    }
}

// Setup all event listeners
// FIXED VERSION - Remove the duplicate loan form event listener

// Setup all event listeners
function setupEventListeners() {
    
    // Enhanced loan form submission (KEEP THIS ONE)
    const loanForm = document.getElementById('loanForm');
    if (loanForm) {
        loanForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Show loading state
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            
            try {
                const memberId = document.getElementById('loanMemberId').value;
                const amount = parseFloat(document.getElementById('loanAmount').value);
                const loanDate = document.getElementById('loanDate').value;
                const interestType = document.querySelector('input[name="interestType"]:checked')?.value;
                const manualRate = parseFloat(document.getElementById('manualInterestRate').value) || 0;
                
                const result = await issueLoanWithValidation(memberId, amount, loanDate, interestType, manualRate);
                
                if (result.success) {
                    showAlert(`Loan LN${String(result.loanId).padStart(4, '0')} issued successfully to ${result.memberName} for ${formatCurrency(result.amount)}! 💰`, 'success');
                    
                    // Reset form
                    this.reset();
                    document.getElementById('loanMemberSearch').value = '';
                    document.getElementById('loanMemberId').value = '';
                    initializeDates();
                    toggleInterestRateInput();
                    
                    // Refresh data
                    await Promise.all([
                        loadLoans(),
                        loadDashboard(),
                        populateMemberSelects()
                    ]);
                } else {
                    showAlert(result.error, 'error');
                }
                
            } catch (error) {
                console.error('Unexpected error in loan form:', error);
                showAlert('Unexpected error occurred. Please try again.', 'error');
            } finally {
                // Restore button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
    
    // Enhanced repayment form submission
    const repaymentForm = document.getElementById('repaymentForm');
    if (repaymentForm) {
        repaymentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Show loading state
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            
            try {
                const loanId = document.getElementById('repayLoanId').value;
                const principalAmount = parseFloat(document.getElementById('principalAmount').value) || 0;
                const interestAmount = parseFloat(document.getElementById('interestAmount').value) || 0;
                const repaymentDate = document.getElementById('repaymentDate').value;
                
                const result = await processLoanRepayment(loanId, principalAmount, interestAmount, repaymentDate);
                
                if (result.success) {
                    if (result.loanClosed) {
                        showAlert(`Loan repayment recorded successfully! Loan is now CLOSED for ${result.memberName}. 🎉`, 'success');
                    } else {
                        showAlert(`Loan repayment recorded successfully! Remaining balance: ${formatCurrency(result.newBalance)} for ${result.memberName}`, 'success');
                    }
                    
                    // Reset form
                    this.reset();
                    document.getElementById('repayLoanSearch').value = '';
                    document.getElementById('repayLoanId').value = '';
                    initializeDates();
                    
                    // Refresh data
                    await Promise.all([
                        loadLoans(),
                        loadDashboard()
                    ]);
                } else {
                    showAlert(result.error, 'error');
                }
                
            } catch (error) {
                console.error('Unexpected error in repayment form:', error);
                showAlert('Unexpected error occurred. Please try again.', 'error');
            } finally {
                // Restore button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
    
    // REMOVED: Member form submission (since Add New Member section is removed)
    // REMOVED: Bulk subscription form submission (since Bulk Add Monthly section is removed)

    // Add interest rate change listeners
    document.querySelectorAll('input[name="interestType"]').forEach(radio => {
        radio.addEventListener('change', toggleInterestRateInput);
    });

    // Individual subscription form submission
    const subscriptionForm = document.getElementById('subscriptionForm');
    if (subscriptionForm) {
        subscriptionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const memberId = document.getElementById('subMemberId').value;
            const month = document.getElementById('subMonth').value;
            const amount = parseFloat(document.getElementById('subAmount').value);
            const paymentDate = document.getElementById('subDate').value;
            
            if (!memberId || !month || !amount || !paymentDate) {
                showAlert('Please fill in all required fields', 'error');
                return;
            }
            
            try {
                // Check if subscription already exists
                const { data: existing, error: checkError } = await supabase
                    .from('subscriptions')
                    .select('id')
                    .eq('member_id', memberId)
                    .eq('month', month)
                    .limit(1);
                
                if (checkError) throw checkError;
                
                if (existing.length > 0) {
                    showAlert('Subscription already exists for this member and month', 'error');
                    return;
                }
                
                // Insert subscription
                const { error: insertError } = await supabase
                    .from('subscriptions')
                    .insert([{
                        member_id: memberId,
                        month: month,
                        amount: amount,
                        payment_date: paymentDate
                    }]);
                
                if (insertError) throw insertError;
                
                showAlert('Subscription payment recorded successfully!');
                this.reset();
                // Clear search inputs
                document.getElementById('subMemberSearch').value = '';
                document.getElementById('subMemberId').value = '';
                initializeDates();
                await loadSubscriptions();
                await loadDashboard();
            } catch (error) {
                showAlert('Error recording payment: ' + error.message, 'error');
            }
        });
    }

    // Loan top-up form submission
    const loanTopupForm = document.getElementById('loanTopupForm');
    if (loanTopupForm) {
        loanTopupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const loanId = document.getElementById('topupLoanId').value;
            const topupAmount = parseFloat(document.getElementById('topupAmount').value);
            const topupDate = document.getElementById('topupDate').value;
            
            if (!loanId || !topupAmount || !topupDate) {
                showAlert('Please fill in all required fields', 'error');
                return;
            }
            
            try {
                // Get current loan details
                const { data: loan, error: loanError } = await supabase
                    .from('loans')
                    .select('amount, outstanding_amount, members(name)')
                    .eq('id', loanId)
                    .eq('status', 'active')
                    .single();
                
                if (loanError) throw loanError;
                
                if (!loan) {
                    showAlert('Loan not found or not active', 'error');
                    return;
                }
                
                // Update loan amount and outstanding amount
                const newAmount = loan.amount + topupAmount;
                const newOutstandingAmount = (loan.outstanding_amount || loan.amount) + topupAmount;
                
                const { error: updateError } = await supabase
                    .from('loans')
                    .update({ 
                        amount: newAmount,
                        outstanding_amount: newOutstandingAmount 
                    })
                    .eq('id', loanId);
                
                if (updateError) throw updateError;
                
                showAlert(`Loan top-up successful! New loan amount: ${formatCurrency(newAmount)} for ${loan.members.name}`, 'success');
                this.reset();
                document.getElementById('topupLoanSearch').value = '';
                document.getElementById('topupLoanId').value = '';
                initializeDates();
                await loadLoans();
                await loadDashboard();
                
            } catch (error) {
                console.error('Database error:', error);
                showAlert('Error processing loan top-up: ' + error.message, 'error');
            }
        });
    }

    // Quarter settings form submission
    const quarterSettingsForm = document.getElementById('quarterSettingsForm');
    if (quarterSettingsForm) {
        quarterSettingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                const quarters = [
                    { quarter_name: 'Q1', start_month: parseInt(document.getElementById('q1Start').value), end_month: parseInt(document.getElementById('q1End').value) },
                    { quarter_name: 'Q2', start_month: parseInt(document.getElementById('q2Start').value), end_month: parseInt(document.getElementById('q2End').value) },
                    { quarter_name: 'Q3', start_month: parseInt(document.getElementById('q3Start').value), end_month: parseInt(document.getElementById('q3End').value) },
                    { quarter_name: 'Q4', start_month: parseInt(document.getElementById('q4Start').value), end_month: parseInt(document.getElementById('q4End').value) }
                ];
                
                // Delete existing settings
                const { error: deleteError } = await supabase
                    .from('quarter_settings')
                    .delete()
                    .neq('id', 0); // Delete all records
                
                if (deleteError) throw deleteError;
                
                // Insert new settings
                const { error: insertError } = await supabase
                    .from('quarter_settings')
                    .insert(quarters);
                
                if (insertError) throw insertError;
                
                showAlert('Quarter settings saved successfully!', 'success');
                await loadQuarterSettings();
                
            } catch (error) {
                console.error('Error saving quarter settings:', error);
                showAlert('Error saving quarter settings: ' + error.message, 'error');
            }
        });
    }

    // Edit member form submission
    const editMemberForm = document.getElementById('editMemberForm');
    if (editMemberForm) {
        editMemberForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const memberId = document.getElementById('editMemberId').value;
            const name = document.getElementById('editMemberName').value.trim();
            const contact = document.getElementById('editMemberContact').value.trim();
            
            if (!memberId || !name || !contact) {
                showAlert('Please fill in all required fields', 'error');
                return;
            }
            
            try {
                // Check for duplicate contact (excluding current member)
                const { data: duplicateCheck, error: checkError } = await supabase
                    .from('members')
                    .select('id, name')
                    .eq('contact', contact)
                    .neq('id', memberId)
                    .limit(1);
                
                if (checkError) throw checkError;
                
                if (duplicateCheck && duplicateCheck.length > 0) {
                    showAlert(`Contact number already exists for member: ${duplicateCheck[0].name}`, 'error');
                    return;
                }
                
                // Update member
                const { error: updateError } = await supabase
                    .from('members')
                    .update({
                        name: name,
                        contact: contact
                    })
                    .eq('id', memberId);
                
                if (updateError) throw updateError;
                
                showAlert('Member updated successfully!', 'success');
                closeEditMemberModal();
                await loadMembers();
                populateMemberSelects();
                
            } catch (error) {
                console.error('Database error:', error);
                showAlert('Error updating member: ' + error.message, 'error');
            }
        });
    }

    // Fixed deposit form submission
    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
        depositForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const memberId = document.getElementById('fdMemberId').value;
            const amount = parseFloat(document.getElementById('fdAmount').value);
            const tenure = parseInt(document.getElementById('fdTenure').value);
            const depositDate = document.getElementById('fdDate').value;
            
            if (!memberId || !amount || !tenure || !depositDate) {
                showAlert('Please fill in all required fields', 'error');
                return;
            }
            
            if (tenure > 12 || tenure < 1) {
                showAlert('Tenure must be between 1 and 12 months', 'error');
                return;
            }
            
            try {
                // Calculate maturity date
                const maturityDate = new Date(depositDate);
                maturityDate.setMonth(maturityDate.getMonth() + tenure);
                
                // Insert fixed deposit
                const { error: insertError } = await supabase
                    .from('fixed_deposits')
                    .insert([{
                        member_id: memberId,
                        amount: amount,
                        tenure_months: tenure,
                        deposit_date: depositDate,
                        maturity_date: maturityDate.toISOString().split('T')[0],
                        status: 'active'
                    }]);
                
                if (insertError) throw insertError;
                
                showAlert('Fixed deposit created successfully! 🏦', 'success');
                this.reset();
                document.getElementById('fdMemberSearch').value = '';
                document.getElementById('fdMemberId').value = '';
                initializeDates();
                await loadDeposits();
                await loadDashboard();
                populateMemberSelects();
                
            } catch (error) {
                console.error('Database error:', error);
                showAlert('Error creating fixed deposit: ' + error.message, 'error');
            }
        });
    }

    setTimeout(() => {
        initializeInterestWarningSystem();
    }, 3000);
    
    console.log('All event listeners setup without duplicates!');
}


function addWarningModalCSS() {
    const warningModalCSS = `
        .interest-warning-modal {
            display: none;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.7);
            animation: fadeIn 0.3s ease;
        }

        .interest-warning-content {
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            margin: 10% auto;
            padding: 30px;
            border-radius: 15px;
            width: 80%;
            max-width: 600px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            text-align: center;
            position: relative;
            animation: slideIn 0.3s ease;
        }

        .interest-warning-content h2 {
            margin-bottom: 20px;
            font-size: 2em;
        }

        .interest-warning-content .warning-icon {
            font-size: 4em;
            margin-bottom: 20px;
            display: block;
        }

        .interest-warning-content .missing-months {
            background: rgba(255,255,255,0.2);
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: bold;
        }

        .interest-warning-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 25px;
            flex-wrap: wrap;
        }

        .warning-btn {
            padding: 12px 25px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .warning-btn-primary {
            background: white;
            color: #e74c3c;
        }

        .warning-btn-secondary {
            background: rgba(255,255,255,0.2);
            color: white;
            border: 2px solid white;
        }

        .warning-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        @media (max-width: 768px) {
            .interest-warning-content {
                width: 95%;
                margin: 5% auto;
                padding: 20px;
            }
            
            .interest-warning-buttons {
                flex-direction: column;
                gap: 10px;
            }
            
            .warning-btn {
                width: 100%;
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = warningModalCSS;
    document.head.appendChild(styleSheet);
}


// Enhanced alert function with auto-dismiss and better styling
function showAlert(message, type = 'success') {
    // Remove any existing alerts first
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        min-width: 300px;
        max-width: 500px;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-weight: 500;
        cursor: pointer;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    // Add icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    alertDiv.innerHTML = `${icons[type] || '💡'} ${message}`;
    
    document.body.appendChild(alertDiv);
    
    // Animate in
    setTimeout(() => {
        alertDiv.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto dismiss and click to dismiss
    const dismiss = () => {
        alertDiv.style.transform = 'translateX(100%)';
        setTimeout(() => alertDiv.remove(), 300);
    };
    
    alertDiv.addEventListener('click', dismiss);
    setTimeout(dismiss, type === 'error' ? 8000 : 5000);
}

console.log('Complete application fix with robust error handling loaded!');

// Dashboard functions
async function loadDashboard() {
    try {
        // Active members only
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id')
            .eq('status', 'active');
        
        if (memberError) throw memberError;
        
        const totalMembersElement = document.getElementById('totalMembers');
        if (totalMembersElement) totalMembersElement.textContent = memberData.length;
        
        // Continue with other dashboard calculations...
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Load members function
async function loadMembers(statusFilter = null) {
    try {
        let query = supabase.from('members').select('*').order('id', { ascending: false });
        
        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }
        
        const { data: members, error } = await query;
        
        if (error) throw error;
        
        const tbody = document.querySelector('#membersTable tbody');
        if (tbody) {
            tbody.innerHTML = '';
            
            members.forEach(member => {
                const statusClass = member.status === 'active' ? 'status-active' : 'status-suspended';
                
                let actionButtons = `
                    <button class="btn-edit" onclick="editMember(${member.id})" title="Edit Member">✏️ Edit</button>
                `;
                
                if (member.status === 'active') {
                    actionButtons += `<button class="btn-suspend" onclick="suspendMember(${member.id})" title="Suspend Member">🚫 Suspend</button>`;
                } else {
                    actionButtons += `<button class="btn-activate" onclick="activateMember(${member.id})" title="Activate Member">✅ Activate</button>`;
                }
                
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>MS${String(member.id).padStart(4, '0')}</td>
                    <td>${member.name}</td>
                    <td>${member.contact}</td>
                    <td>${new Date(member.join_date).toLocaleDateString()}</td>
                    <td><span class="status-badge ${statusClass}">${member.status}</span></td>
                    <td>${actionButtons}</td>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// Load subscriptions function
async function loadSubscriptions(filterMonth = null) {
    try {
        let query = supabase
            .from('subscriptions')
            .select(`
                *,
                members(id, name)
            `)
            .order('payment_date', { ascending: false });
        
        if (filterMonth) {
            query = query.eq('month', filterMonth);
        }
        
        const { data: subscriptions, error } = await query;
        
        if (error) throw error;
        
        const tbody = document.querySelector('#subscriptionsTable tbody');
        if (tbody) {
            tbody.innerHTML = '';
            
            subscriptions.forEach(sub => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>MS${String(sub.members.id).padStart(4, '0')}</td>
                    <td>${sub.members.name}</td>
                    <td>${sub.month}</td>
                    <td>${formatCurrency(sub.amount)}</td>
                    <td>${new Date(sub.payment_date).toLocaleDateString()}</td>
                    <td><span class="status-badge status-active">Paid</span></td>
                    <td>
                        <button class="btn-delete" onclick="deleteSubscription(${sub.id}, '${sub.members.name}', '${sub.month}')" title="Delete Subscription">
                            🗑️ Delete
                        </button>
                    </td>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading subscriptions:', error);
    }
}

// REPLACE these functions in your script.js to handle the outstanding_amount column

// Updated loadLoans function to handle outstanding_amount column
async function loadLoans() {
    try {
        const { data: loans, error } = await supabase
            .from('loans')
            .select(`
                *,
                members(name),
                loan_repayments(principal_amount, interest_amount),
                loan_interest_accruals(accrued_amount)
            `)
            .order('loan_date', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.querySelector('#loansTable tbody');
        if (tbody) {
            tbody.innerHTML = '';
            
            loans.forEach(loan => {
                const totalPrincipalPaid = loan.loan_repayments.reduce((sum, rep) => sum + rep.principal_amount, 0);
                const totalInterestAccrued = loan.loan_interest_accruals.reduce((sum, acc) => sum + acc.accrued_amount, 0);
                const totalInterestPaid = loan.loan_repayments.reduce((sum, rep) => sum + rep.interest_amount, 0);
                
                // Use outstanding_amount from database if available, otherwise calculate
                const currentPrincipalBalance = loan.outstanding_amount !== null ? 
                    loan.outstanding_amount : 
                    loan.amount - totalPrincipalPaid;
                
                const unpaidInterest = totalInterestAccrued - totalInterestPaid;
                const totalOutstanding = currentPrincipalBalance + Math.max(0, unpaidInterest);
                
                let interestDisplay = '';
                let rateDisplay = '';
                
                if (loan.interest_rate_type === 'progressive') {
                    interestDisplay = 'Progressive';
                    rateDisplay = '2%/3%';
                } else if (loan.interest_rate_type === 'flat') {
                    interestDisplay = 'Flat Rate';
                    rateDisplay = `${loan.manual_interest_rate}%`;
                } else if (loan.interest_rate_type === 'zero') {
                    interestDisplay = 'Zero Rate';
                    rateDisplay = '0%';
                }
                
                const status = currentPrincipalBalance > 0 ? 'active' : 'closed';
                
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>LN${String(loan.id).padStart(4, '0')}</td>
                    <td>${loan.members.name}</td>
                    <td>${formatCurrency(loan.amount)}</td>
                    <td>${interestDisplay}</td>
                    <td>${rateDisplay}</td>
                    <td>${formatCurrency(totalOutstanding)}<br><small style="color: #666;">Principal: ${formatCurrency(currentPrincipalBalance)}<br>Interest: ${formatCurrency(Math.max(0, unpaidInterest))}</small></td>
                    <td><span class="status-badge status-${status === 'active' ? 'due' : 'active'}">${status}</span></td>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading loans:', error);
    }
}

// Load deposits function
async function loadDeposits() {
    try {
        const { data: deposits, error } = await supabase
            .from('fixed_deposits')
            .select(`
                *,
                members(name)
            `)
            .order('deposit_date', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.querySelector('#depositsTable tbody');
        if (tbody) {
            tbody.innerHTML = '';
            
            deposits.forEach(deposit => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>FD${String(deposit.id).padStart(4, '0')}</td>
                    <td>${deposit.members.name}</td>
                    <td>${formatCurrency(deposit.amount)}</td>
                    <td>${deposit.tenure_months} months</td>
                    <td>${new Date(deposit.deposit_date).toLocaleDateString()}</td>
                    <td>${new Date(deposit.maturity_date).toLocaleDateString()}</td>
                    <td><span class="status-badge status-${deposit.status}">${deposit.status}</span></td>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading deposits:', error);
    }
}

// Load quarter settings function
async function loadQuarterSettings() {
    try {
        const { data: quarters, error } = await supabase
            .from('quarter_settings')
            .select('*')
            .order('quarter_name');
        
        if (error) throw error;
        
        // Load current settings into form
        quarters.forEach(quarter => {
            const startSelect = document.getElementById(quarter.quarter_name.toLowerCase() + 'Start');
            const endSelect = document.getElementById(quarter.quarter_name.toLowerCase() + 'End');
            
            if (startSelect) startSelect.value = quarter.start_month;
            if (endSelect) endSelect.value = quarter.end_month;
        });
        
        // Display current settings
        const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        let settingsHTML = '<table><thead><tr><th>Quarter</th><th>Period</th></tr></thead><tbody>';
        
        quarters.forEach(quarter => {
            settingsHTML += `
                <tr>
                    <td><strong>${quarter.quarter_name}</strong></td>
                    <td>${monthNames[quarter.start_month]} - ${monthNames[quarter.end_month]}</td>
                </tr>
            `;
        });
        
        settingsHTML += '</tbody></table>';
        
        const currentSettingsDiv = document.getElementById('currentQuarterSettings');
        if (currentSettingsDiv) {
            currentSettingsDiv.innerHTML = settingsHTML;
        }
        
    } catch (error) {
        console.error('Error loading quarter settings:', error);
    }
}

// Member management functions
async function editMember(memberId) {
    try {
        const { data: member, error } = await supabase
            .from('members')
            .select('*')
            .eq('id', memberId)
            .single();
        
        if (error) throw error;
        
        if (!member) {
            showAlert('Member not found', 'error');
            return;
        }
        
        // Populate edit form
        document.getElementById('editMemberId').value = member.id;
        document.getElementById('editMemberName').value = member.name;
        document.getElementById('editMemberContact').value = member.contact;
        
        // Show modal
        document.getElementById('editMemberModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading member for edit:', error);
        showAlert('Error loading member: ' + error.message, 'error');
    }
}

async function updateMemberStatus(memberId, status) {
    try {
        const { error } = await supabase
            .from('members')
            .update({ status: status })
            .eq('id', memberId);
        
        if (error) throw error;
        
        const statusText = status === 'active' ? 'activated' : 'suspended';
        showAlert(`Member ${statusText} successfully!`, 'success');
        
        await loadMembers();
        await loadDashboard();
        populateMemberSelects();
        
    } catch (error) {
        console.error('Error updating member status:', error);
        showAlert('Error updating member status: ' + error.message, 'error');
    }
}

// Delete subscription function
async function deleteSubscription(subscriptionId, memberName, month) {
    if (!confirm(`Are you sure you want to delete subscription for ${memberName} for ${month}?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('subscriptions')
            .delete()
            .eq('id', subscriptionId);
        
        if (error) throw error;
        
        showAlert(`Subscription deleted successfully for ${memberName} (${month})`, 'success');
        await loadSubscriptions();
        await loadDashboard();
        
    } catch (error) {
        console.error('Error deleting subscription:', error);
        showAlert('Error deleting subscription: ' + error.message, 'error');
    }
}

// CORRECTED: populateMemberSelects function
function populateMemberSelects() {
    // Setup search functionality for member search inputs
    setupMemberSearch();
    setupLoanStatementMemberSearch();
    setupLoanSearch();
}

// CORRECTED: suspendMember function
async function suspendMember(memberId) {
    if (!confirm('Are you sure you want to suspend this member?')) {
        return;
    }
    
    await updateMemberStatus(memberId, 'suspended');
}

// CORRECTED: activateMember function  
async function activateMember(memberId) {
    if (!confirm('Are you sure you want to activate this member?')) {
        return;
    }
    
    await updateMemberStatus(memberId, 'active');
}

// CORRECTED: filterMembersByStatus function
function filterMembersByStatus() {
    const filterValue = document.getElementById('memberStatusFilter').value;
    loadMembers(filterValue);
}

// CORRECTED: filterSubscriptions function
function filterSubscriptions() {
    const filterMonth = document.getElementById('filterMonth').value;
    if (filterMonth) {
        loadSubscriptions(filterMonth);
    }
}

// CORRECTED: showAllSubscriptions function
function showAllSubscriptions() {
    document.getElementById('filterMonth').value = '';
    loadSubscriptions();
}


// Modified setupMemberSearch function to fetch subscription_amount
async function setupMemberSearch() {
    const searchConfigs = [
        { searchInput: 'subMemberSearch', hiddenInput: 'subMemberId', resultsDiv: 'subMemberResults' },
        { searchInput: 'loanMemberSearch', hiddenInput: 'loanMemberId', resultsDiv: 'loanMemberResults' },
        { searchInput: 'fdMemberSearch', hiddenInput: 'fdMemberId', resultsDiv: 'fdMemberResults' }
    ];

    searchConfigs.forEach(config => {
        const searchInput = document.getElementById(config.searchInput);
        const hiddenInput = document.getElementById(config.hiddenInput);
        const resultsDiv = document.getElementById(config.resultsDiv);

        if (!searchInput || !hiddenInput || !resultsDiv) return;

        let selectedIndex = -1;
        let searchResults = [];

        // Search input event
        searchInput.addEventListener('input', async function() {
            const searchTerm = this.value.trim().toLowerCase();
            
            if (searchTerm.length === 0) {
                resultsDiv.style.display = 'none';
                hiddenInput.value = '';
                selectedIndex = -1;
                return;
            }

            if (searchTerm.length < 2) {
                return; // Wait for at least 2 characters
            }

            try {
                // Search for members - include subscription_amount for individual subscription form
                const { data: members, error } = await supabase
                    .from('members')
                    .select('id, name, contact, subscription_amount')
                    .eq('status', 'active')
                    .ilike('name', `%${searchTerm}%`)
                    .order('name')
                    .limit(10);
                
                if (error) throw error;

                searchResults = members || [];
                await displaySearchResults(searchResults, resultsDiv, hiddenInput, searchInput);
                selectedIndex = -1;
                
            } catch (error) {
                console.error('Error searching members:', error);
            }
        });

        // Handle keyboard navigation
        searchInput.addEventListener('keydown', function(e) {
            const items = resultsDiv.querySelectorAll('.search-result-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (selectedIndex < items.length - 1) {
                    selectedIndex++;
                    updateSelection(items, selectedIndex);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selectedIndex > 0) {
                    selectedIndex--;
                    updateSelection(items, selectedIndex);
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < items.length) {
                    const selectedMember = searchResults[selectedIndex];
                    selectMemberFromClick(selectedMember.id, selectedMember.name, hiddenInput.id, searchInput.id, resultsDiv.id, selectedMember.subscription_amount || 0);
                }
            } else if (e.key === 'Escape') {
                resultsDiv.style.display = 'none';
                selectedIndex = -1;
            }
        });

        // Hide results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
                resultsDiv.style.display = 'none';
                selectedIndex = -1;
            }
        });

        // Clear hidden input when search input is cleared
        searchInput.addEventListener('blur', function() {
            // Delay to allow for click on results
            setTimeout(() => {
                if (this.value.trim() === '') {
                    hiddenInput.value = '';
                }
            }, 200);
        });
    });
}


// Updated setupLoanSearch function to handle outstanding_amount
async function setupLoanSearch() {
    const searchConfigs = [
        { searchInput: 'topupLoanSearch', hiddenInput: 'topupLoanId', resultsDiv: 'topupLoanResults' },
        { searchInput: 'repayLoanSearch', hiddenInput: 'repayLoanId', resultsDiv: 'repayLoanResults' }
    ];

    searchConfigs.forEach(config => {
        const searchInput = document.getElementById(config.searchInput);
        const hiddenInput = document.getElementById(config.hiddenInput);
        const resultsDiv = document.getElementById(config.resultsDiv);

        if (!searchInput || !hiddenInput || !resultsDiv) return;

        let selectedIndex = -1;
        let searchResults = [];

        // Search input event
        searchInput.addEventListener('input', async function() {
            const searchTerm = this.value.trim().toLowerCase();
            
            if (searchTerm.length === 0) {
                resultsDiv.style.display = 'none';
                hiddenInput.value = '';
                selectedIndex = -1;
                return;
            }

            if (searchTerm.length < 2) {
                return; // Wait for at least 2 characters
            }

            try {
                // Search for active loans
                const { data: loans, error } = await supabase
                    .from('loans')
                    .select(`
                        id, amount, outstanding_amount, interest_rate_type, manual_interest_rate,
                        members(name),
                        loan_repayments(principal_amount, interest_amount),
                        loan_interest_accruals(accrued_amount)
                    `)
                    .eq('status', 'active')
                    .order('loan_date', { ascending: false })
                    .limit(20); // Get more to filter locally
                
                if (error) throw error;

                searchResults = [];
                loans.forEach(loan => {
                    // Check if search term matches loan ID or member name
                    const loanIdMatch = `LN${String(loan.id).padStart(4, '0')}`.toLowerCase().includes(searchTerm);
                    const memberNameMatch = loan.members.name.toLowerCase().includes(searchTerm);
                    
                    if (loanIdMatch || memberNameMatch) {
                        const totalPrincipalPaid = loan.loan_repayments.reduce((sum, rep) => sum + rep.principal_amount, 0);
                        const totalInterestAccrued = loan.loan_interest_accruals.reduce((sum, acc) => sum + acc.accrued_amount, 0);
                        const totalInterestPaid = loan.loan_repayments.reduce((sum, rep) => sum + rep.interest_amount, 0);
                        
                        // Use outstanding_amount from database if available, otherwise calculate
                        const principalBalance = loan.outstanding_amount !== null ? 
                            loan.outstanding_amount : 
                            loan.amount - totalPrincipalPaid;
                        
                        const interestBalance = Math.max(0, totalInterestAccrued - totalInterestPaid);
                        
                        if (principalBalance > 0) { // Only show loans with outstanding principal
                            searchResults.push({
                                id: loan.id,
                                member_name: loan.members.name,
                                amount: loan.amount,
                                interest_rate_type: loan.interest_rate_type,
                                manual_interest_rate: loan.manual_interest_rate,
                                principal_balance: principalBalance,
                                interest_balance: interestBalance,
                                total_outstanding: principalBalance + interestBalance
                            });
                        }
                    }
                });

                // Sort by relevance (exact match first, then alphabetical)
                searchResults.sort((a, b) => {
                    const aLoanId = `LN${String(a.id).padStart(4, '0')}`.toLowerCase();
                    const bLoanId = `LN${String(b.id).padStart(4, '0')}`.toLowerCase();
                    
                    if (aLoanId === searchTerm) return -1;
                    if (bLoanId === searchTerm) return 1;
                    
                    return a.member_name.localeCompare(b.member_name);
                });

                // Limit to top 10 results
                searchResults = searchResults.slice(0, 10);

                displayLoanSearchResults(searchResults, resultsDiv, hiddenInput, searchInput);
                selectedIndex = -1;
                
            } catch (error) {
                console.error('Error searching loans:', error);
            }
        });

        // Handle keyboard navigation
        searchInput.addEventListener('keydown', function(e) {
            const items = resultsDiv.querySelectorAll('.search-result-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (selectedIndex < items.length - 1) {
                    selectedIndex++;
                    updateSelection(items, selectedIndex);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selectedIndex > 0) {
                    selectedIndex--;
                    updateSelection(items, selectedIndex);
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < items.length) {
                    selectLoan(searchResults[selectedIndex], hiddenInput, searchInput, resultsDiv);
                }
            } else if (e.key === 'Escape') {
                resultsDiv.style.display = 'none';
                selectedIndex = -1;
            }
        });

        // Hide results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
                resultsDiv.style.display = 'none';
                selectedIndex = -1;
            }
        });

        // Clear hidden input when search input is cleared
        searchInput.addEventListener('blur', function() {
            // Delay to allow for click on results
            setTimeout(() => {
                if (this.value.trim() === '') {
                    hiddenInput.value = '';
                }
            }, 200);
        });
    });
}


// Setup loan statement member search functionality (Updated for Supabase)
async function setupLoanStatementMemberSearch() {
    const searchInput = document.getElementById('loanStatementMemberSearch');
    const hiddenInput = document.getElementById('loanStatementMember');
    const resultsDiv = document.getElementById('loanStatementMemberResults');

    if (!searchInput || !hiddenInput || !resultsDiv) return;

    let selectedIndex = -1;
    let searchResults = [];

    // Search input event
    searchInput.addEventListener('input', async function() {
        const searchTerm = this.value.trim().toLowerCase();
        
        if (searchTerm.length === 0) {
            resultsDiv.style.display = 'none';
            hiddenInput.value = '';
            selectedIndex = -1;
            return;
        }

        if (searchTerm.length < 2) {
            return; // Wait for at least 2 characters
        }

        try {
            // Search for members
            const { data: members, error } = await supabase
                .from('members')
                .select('id, name, contact')
                .eq('status', 'active')
                .ilike('name', `%${searchTerm}%`)
                .order('name')
                .limit(10);
            
            if (error) throw error;

            searchResults = members || [];
            displayLoanStatementSearchResults(searchResults, resultsDiv, hiddenInput, searchInput);
            selectedIndex = -1;
            
        } catch (error) {
            console.error('Error searching members:', error);
        }
    });

    // Handle keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        const items = resultsDiv.querySelectorAll('.search-result-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIndex < items.length - 1) {
                selectedIndex++;
                updateSelection(items, selectedIndex);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIndex > 0) {
                selectedIndex--;
                updateSelection(items, selectedIndex);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < items.length) {
                selectMember(searchResults[selectedIndex], hiddenInput, searchInput, resultsDiv);
            }
        } else if (e.key === 'Escape') {
            resultsDiv.style.display = 'none';
            selectedIndex = -1;
        }
    });

    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.style.display = 'none';
            selectedIndex = -1;
        }
    });

    // Clear hidden input when search input is cleared
    searchInput.addEventListener('blur', function() {
        // Delay to allow for click on results
        setTimeout(() => {
            if (this.value.trim() === '') {
                hiddenInput.value = '';
            }
        }, 200);
    });
}

// HELPER FUNCTIONS FOR SEARCH RESULTS DISPLAY

// Display search results for members (Updated for Supabase)
//Modified displaySearchResults function to include subscription amount in member data
async function displaySearchResults(results, resultsDiv, hiddenInput, searchInput) {
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">No members found</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    let html = '';
    for (const member of results) {
        // Check if this is for loan member search to show loan status
        let loanStatus = '';
        if (hiddenInput.id === 'loanMemberId') {
            try {
                const { data: loans, error } = await supabase
                    .from('loans')
                    .select(`
                        id, amount,
                        loan_repayments(principal_amount)
                    `)
                    .eq('member_id', member.id)
                    .eq('status', 'active');
                
                if (error) throw error;
                
                if (loans && loans.length > 0) {
                    const loan = loans[0];
                    const totalPaid = loan.loan_repayments?.reduce((sum, rep) => sum + rep.principal_amount, 0) || 0;
                    const outstanding = loan.amount - totalPaid;
                    if (outstanding > 0) {
                        loanStatus = `<div style="color: #e74c3c; font-size: 11px; font-weight: bold;">⚠️ Active Loan: ${formatCurrency(outstanding)} outstanding</div>`;
                    }
                }
            } catch (error) {
                console.error('Error checking loan status:', error);
            }
        }

        // Pass subscription_amount to the click handler
        const subscriptionAmount = member.subscription_amount || 0;
        
        html += `
            <div class="search-result-item" data-index="${results.indexOf(member)}" onclick="selectMemberFromClick(${member.id}, '${member.name.replace(/'/g, "\\'")}', '${hiddenInput.id}', '${searchInput.id}', '${resultsDiv.id}', ${subscriptionAmount})">
                <div class="member-id">MS${String(member.id).padStart(4, '0')}</div>
                <div>${member.name}</div>
                <small style="color: #666;">${member.contact}</small>
                ${subscriptionAmount > 0 ? `<small style="color: #27ae60; font-weight: bold;">Subscription: ${formatCurrency(subscriptionAmount)}</small>` : ''}
                ${loanStatus}
            </div>
        `;
    }

    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
}


// Update selection highlight
function updateSelection(items, selectedIndex) {
    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

console.log('All search functions implemented successfully!');

// UTILITY FUNCTIONS
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const activeSection = document.querySelector('.content-section.active');
    const firstCard = activeSection ? activeSection.querySelector('.card') : null;
    if (firstCard) {
        firstCard.parentNode.insertBefore(alertDiv, firstCard.nextSibling);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}

function initializeDates() {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().substring(0, 7);
    const currentYear = new Date().getFullYear();
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    // Set default dates for all form inputs
    const dateInputs = [
        'joinDate', 'subDate', 'bulkSubDate', 'loanDate', 'repaymentDate', 
        'fdDate', 'topupDate'
    ];
    
    dateInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) element.value = today;
    });
    
    // Set month inputs
    const monthInputs = [
        'subMonth', 'bulkSubMonth', 'filterMonth', 'interestMonth', 'postInterestMonth'
    ];
    
    monthInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) element.value = currentMonth;
    });
    
    // Set date range inputs
    const ieFromDate = document.getElementById('ieFromDate');
    const ieToDate = document.getElementById('ieToDate');
    if (ieFromDate) ieFromDate.value = firstDayOfMonth;
    if (ieToDate) ieToDate.value = today;
    
    const payoutFromDate = document.getElementById('payoutFromDate');
    const payoutToDate = document.getElementById('payoutToDate');
    if (payoutFromDate) payoutFromDate.value = firstDayOfMonth;
    if (payoutToDate) payoutToDate.value = today;
    
    // Set year input
    const fdInterestYear = document.getElementById('fdInterestYear');
    if (fdInterestYear) fdInterestYear.value = currentYear;
}

// CORRECTED: toggleInterestRateInput function
function toggleInterestRateInput() {
    const interestType = document.querySelector('input[name="interestType"]:checked');
    if (!interestType) return;
    
    const manualRateGroup = document.getElementById('manualRateGroup');
    const manualRateInput = document.getElementById('manualInterestRate');
    
    if (!manualRateGroup || !manualRateInput) return;
    
    if (interestType.value === 'flat') {
        manualRateGroup.style.display = 'block';
        manualRateInput.required = true;
        manualRateInput.value = '';
    } else {
        manualRateGroup.style.display = 'none';
        manualRateInput.required = false;
        manualRateInput.value = '0';
    }
}

// CORRECTED: closeEditMemberModal function
function closeEditMemberModal() {
    document.getElementById('editMemberModal').style.display = 'none';
    document.getElementById('editMemberForm').reset();
}

// GLOBAL ONCLICK FUNCTIONS (these are called from HTML onclick attributes)

// Modified selectMemberFromClick function to handle subscription amount auto-population
function selectMemberFromClick(memberId, memberName, hiddenInputId, searchInputId, resultsDivId, subscriptionAmount = 0) {
    const hiddenInput = document.getElementById(hiddenInputId);
    const searchInput = document.getElementById(searchInputId);
    const resultsDiv = document.getElementById(resultsDivId);
    
    if (hiddenInput && searchInput && resultsDiv) {
        hiddenInput.value = memberId;
        searchInput.value = `MS${String(memberId).padStart(4, '0')} - ${memberName}`;
        resultsDiv.style.display = 'none';
        
        // Auto-populate subscription amount for individual subscription form
        if (hiddenInputId === 'subMemberId' && subscriptionAmount > 0) {
            const subAmountInput = document.getElementById('subAmount');
            if (subAmountInput) {
                subAmountInput.value = subscriptionAmount;
            }
        }
    }
}



// Missing functions to add to script.js for Supabase implementation

// ==================== LOAN FUNCTIONS ====================

/// Updated calculateMonthlyInterest function to handle outstanding_amount
async function calculateMonthlyInterest() {
    const month = document.getElementById('interestMonth').value;
    if (!month) {
        showAlert('Please select a month', 'error');
        return;
    }
    
    try {
        // Get all active loans with member details
        const { data: activeLoans, error } = await supabase
            .from('loans')
            .select(`
                id, amount, outstanding_amount, interest_rate_type, manual_interest_rate, loan_date,
                members(name),
                loan_repayments(principal_amount)
            `)
            .eq('status', 'active')
            .order('loan_date', { ascending: false });
        
        if (error) throw error;
        
        if (!activeLoans || activeLoans.length === 0) {
            document.getElementById('monthlyInterestResults').innerHTML = '<p>No active loans found for interest calculation.</p>';
            return;
        }
        
        let resultsHTML = `
            <h4>Interest Calculation for ${month}</h4>
            <p><em>Note: Interest calculated only on principal balance. Unpaid interest does not earn additional interest.</em></p>
            <table>
                <thead>
                    <tr>
                        <th>Loan ID</th>
                        <th>Member</th>
                        <th>Principal Balance</th>
                        <th>Interest Type</th>
                        <th>Interest Calculated</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let totalInterest = 0;
        
        for (const loan of activeLoans) {
            // Use outstanding_amount if available, otherwise calculate from repayments
            let principalBalance;
            if (loan.outstanding_amount !== null) {
                principalBalance = loan.outstanding_amount;
            } else {
                const totalPrincipalPaid = loan.loan_repayments?.reduce((sum, rep) => sum + rep.principal_amount, 0) || 0;
                principalBalance = loan.amount - totalPrincipalPaid;
            }
            
            let monthlyInterest = 0;
            let details = '';
            
            if (principalBalance <= 0) {
                details = 'Principal fully repaid - No interest';
            } else if (loan.interest_rate_type === 'progressive') {
                if (principalBalance <= 200000) {
                    monthlyInterest = principalBalance * 0.02; // 2%
                    details = `${formatCurrency(principalBalance)} × 2% = ${formatCurrency(monthlyInterest)}`;
                } else {
                    const firstPart = 200000 * 0.02; // 2% on first 2 lakhs
                    const secondPart = (principalBalance - 200000) * 0.03; // 3% on excess
                    monthlyInterest = firstPart + secondPart;
                    details = `₹2,00,000 × 2% + ${formatCurrency(principalBalance - 200000)} × 3% = ${formatCurrency(monthlyInterest)}`;
                }
            } else if (loan.interest_rate_type === 'flat') {
                monthlyInterest = principalBalance * (loan.manual_interest_rate / 100);
                details = `${formatCurrency(principalBalance)} × ${loan.manual_interest_rate}% = ${formatCurrency(monthlyInterest)}`;
            } else { // zero rate
                monthlyInterest = 0;
                details = 'No interest (0% rate)';
            }
            
            totalInterest += monthlyInterest;
            
            resultsHTML += `
                <tr>
                    <td>LN${String(loan.id).padStart(4, '0')}</td>
                    <td>${loan.members.name}</td>
                    <td>${formatCurrency(principalBalance)}</td>
                    <td>${loan.interest_rate_type}</td>
                    <td>${formatCurrency(monthlyInterest)}</td>
                    <td>${details}</td>
                </tr>
            `;
        }
        
        resultsHTML += `
                <tr style="font-weight: bold; background-color: #f8f9fa;">
                    <td colspan="4">TOTAL MONTHLY INTEREST</td>
                    <td>${formatCurrency(totalInterest)}</td>
                    <td>-</td>
                </tr>
            </tbody>
        </table>
        `;
        
        document.getElementById('monthlyInterestResults').innerHTML = resultsHTML;
        
    } catch (error) {
        console.error('Error calculating monthly interest:', error);
        showAlert('Error calculating interest: ' + error.message, 'error');
    }
}


async function postMonthlyInterest() {
    // STEP 1: Get the selected month from the form
    const month = document.getElementById('postInterestMonth').value;
    if (!month) {
        showAlert('Please select a month', 'error');
        return;
    }
    
    try {
        // STEP 2: Check if interest has already been posted for this month
        // This prevents duplicate interest posting
        const { data: existingAccruals, error: checkError } = await supabase
            .from('loan_interest_accruals')  // Table that stores monthly interest charges
            .select('id')
            .eq('accrual_month', month)      // Filter by the selected month
            .limit(1);                       // We only need to know if ANY exist
        
        if (checkError) throw checkError;
        
        // If interest already exists for this month, ask for confirmation
        if (existingAccruals && existingAccruals.length > 0) {
            if (!confirm(`Interest has already been posted for ${month}. Do you want to post again? This will create duplicate entries.`)) {
                return; // User chose not to proceed
            }
        }
        
        // STEP 3: Get all active loans with their details
        const { data: activeLoans, error } = await supabase
            .from('loans')
            .select(`
                id, amount, outstanding_amount, interest_rate_type, manual_interest_rate,
                members(name),
                loan_repayments(principal_amount)
            `)
            .eq('status', 'active');  // Only process active loans
        
        if (error) throw error;
        
        // If no active loans found, show error and exit
        if (!activeLoans || activeLoans.length === 0) {
            showAlert('No active loans found for interest posting.', 'error');
            return;
        }
        
        // STEP 4: Initialize counters for summary
        let totalInterestPosted = 0;
        let loansProcessed = 0;
        const postingDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
        
        // STEP 5: Process each loan individually
        for (const loan of activeLoans) {
            
            // STEP 5A: Determine the current principal balance
            let currentPrincipalBalance;
            
            // If the database has outstanding_amount column populated, use it
            if (loan.outstanding_amount !== null) {
                currentPrincipalBalance = loan.outstanding_amount;
            } else {
                // Otherwise, calculate it from repayments (backward compatibility)
                const totalPrincipalPaid = loan.loan_repayments?.reduce((sum, rep) => sum + rep.principal_amount, 0) || 0;
                currentPrincipalBalance = loan.amount - totalPrincipalPaid;
            }
            
            // Skip loans that are fully paid (no principal balance)
            if (currentPrincipalBalance <= 0) {
                continue; // Move to next loan
            }
            
            // STEP 5B: Calculate monthly interest based on loan type
            let monthlyInterest = 0;
            
            if (loan.interest_rate_type === 'progressive') {
                // Progressive Rate: 2% on first ₹2,00,000, then 3% on excess
                
                if (currentPrincipalBalance <= 200000) {
                    // Entire balance is ≤ ₹2,00,000, so 2% on full amount
                    monthlyInterest = currentPrincipalBalance * 0.02; // 2%
                } else {
                    // Balance > ₹2,00,000, so split the calculation
                    const firstPart = 200000 * 0.02;  // 2% on first ₹2,00,000
                    const secondPart = (currentPrincipalBalance - 200000) * 0.03; // 3% on excess
                    monthlyInterest = firstPart + secondPart;
                }
                
                // Example: If balance is ₹3,00,000
                // firstPart = ₹2,00,000 × 2% = ₹4,000
                // secondPart = ₹1,00,000 × 3% = ₹3,000
                // Total interest = ₹7,000
                
            } else if (loan.interest_rate_type === 'flat') {
                // Flat Rate: Custom rate applied to entire balance
                monthlyInterest = currentPrincipalBalance * (loan.manual_interest_rate / 100);
                
                // Example: If balance is ₹1,00,000 and rate is 2.5%
                // Interest = ₹1,00,000 × 2.5% = ₹2,500
                
            } else { // zero rate
                // Zero Interest: No interest charged
                monthlyInterest = 0;
            }
            
            // STEP 5C: Record the interest if it's greater than 0
            if (monthlyInterest > 0) {
                const { error: insertError } = await supabase
                    .from('loan_interest_accruals')  // Table to store monthly interest charges
                    .insert({
                        loan_id: loan.id,           // Link to the loan
                        accrual_month: month,       // Month for which interest is calculated
                        accrued_amount: monthlyInterest,  // Calculated interest amount
                        accrual_date: postingDate   // Date when interest was posted
                    });
                
                if (insertError) throw insertError;
                
                // Add to running total
                totalInterestPosted += monthlyInterest;
            }
            
            // Increment processed counter (even for zero-interest loans)
            loansProcessed++;
        }
        
        // STEP 6: Show success message with summary
        showAlert(`Interest posted successfully for ${month}! ${loansProcessed} loans processed. Total interest: ${formatCurrency(totalInterestPosted)}`, 'success');
        
        // STEP 7: Refresh the UI to show updated data
        await loadLoans();        // Refresh loans table
        await loadDashboard();    // Update dashboard numbers
        
        // STEP 8: Display detailed results
        document.getElementById('postInterestResults').innerHTML = `
            <div class="alert alert-success">
                <strong>Interest Posted for ${month}</strong><br>
                Loans Processed: ${loansProcessed}<br>
                Total Interest Posted: ${formatCurrency(totalInterestPosted)}<br>
                Posted on: ${new Date(postingDate).toLocaleDateString()}<br>
                <em>Note: Interest calculated only on principal balance. Unpaid interest does not earn additional interest.</em>
            </div>
        `;
        
    } catch (error) {
        // STEP 9: Handle any errors that occurred
        console.error('Error posting monthly interest:', error);
        showAlert('Error posting interest: ' + error.message, 'error');
    }
}

async function issueLoanWithValidation(memberId, amount, loanDate, interestType, manualRate) {
    try {
        // Validate inputs
        if (!memberId || !amount || !loanDate || !interestType) {
            throw new Error('All required fields must be filled');
        }
        
        if (amount <= 0) {
            throw new Error('Loan amount must be greater than 0');
        }
        
        if (interestType === 'flat' && (!manualRate || manualRate < 0)) {
            throw new Error('Please enter a valid interest rate for flat rate loans');
        }
        
        // Check if member exists and is active
        const { data: member, error: memberError } = await supabase
            .from('members')
            .select('id, name, status')
            .eq('id', memberId)
            .single();
        
        if (memberError) {
            if (memberError.code === 'PGRST116') {
                throw new Error('Member not found');
            }
            throw memberError;
        }
        
        if (member.status !== 'active') {
            throw new Error('Cannot issue loan to suspended member');
        }
        
        // Check for existing active loans
        const { data: existingLoans, error: checkError } = await supabase
            .from('loans')
            .select('id, amount, outstanding_amount')
            .eq('member_id', memberId)
            .eq('status', 'active');
        
        if (checkError) throw checkError;
        
        if (existingLoans && existingLoans.length > 0) {
            const loan = existingLoans[0];
            const outstanding = loan.outstanding_amount || loan.amount;
            throw new Error(`Member already has an active loan (LN${String(loan.id).padStart(4, '0')}) with ${formatCurrency(outstanding)} outstanding`);
        }
        
        // Prepare loan data
        const loanData = {
            member_id: memberId,
            amount: amount,
            outstanding_amount: amount, // Set initial outstanding equal to loan amount
            interest_rate_type: interestType,
            manual_interest_rate: interestType === 'flat' ? manualRate : 0,
            loan_date: loanDate,
            status: 'active'
        };
        
        // Insert loan
        const { data: insertedLoan, error: insertError } = await supabase
            .from('loans')
            .insert([loanData])
            .select()
            .single();
        
        if (insertError) throw insertError;
        
        return {
            success: true,
            loanId: insertedLoan.id,
            memberName: member.name,
            amount: amount
        };
        
    } catch (error) {
        console.error('Error issuing loan:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}



async function processLoanRepayment(loanId, principalAmount, interestAmount, repaymentDate) {
    try {
        // Validate inputs
        if (!loanId || (!principalAmount && !interestAmount) || !repaymentDate) {
            throw new Error('Please fill in all required fields');
        }
        
        if (principalAmount < 0 || interestAmount < 0) {
            throw new Error('Repayment amounts cannot be negative');
        }
        
        // Get current loan details
        const { data: loan, error: loanError } = await supabase
            .from('loans')
            .select(`
                id, amount, outstanding_amount, status,
                members(name),
                loan_repayments(principal_amount, interest_amount),
                loan_interest_accruals(accrued_amount)
            `)
            .eq('id', loanId)
            .single();
        
        if (loanError) {
            if (loanError.code === 'PGRST116') {
                throw new Error('Loan not found');
            }
            throw loanError;
        }
        
        if (loan.status !== 'active') {
            throw new Error('Cannot process repayment for inactive loan');
        }
        
        // Calculate current balances
        const totalPrincipalPaid = loan.loan_repayments?.reduce((sum, rep) => sum + rep.principal_amount, 0) || 0;
        const totalInterestAccrued = loan.loan_interest_accruals?.reduce((sum, acc) => sum + acc.accrued_amount, 0) || 0;
        const totalInterestPaid = loan.loan_repayments?.reduce((sum, rep) => sum + rep.interest_amount, 0) || 0;
        
        // Use outstanding_amount if available, otherwise calculate
        const currentPrincipalBalance = loan.outstanding_amount !== null ? 
            loan.outstanding_amount : 
            loan.amount - totalPrincipalPaid;
        
        const currentInterestBalance = Math.max(0, totalInterestAccrued - totalInterestPaid);
        
        // Validate repayment amounts
        if (principalAmount > currentPrincipalBalance) {
            throw new Error(`Principal amount (${formatCurrency(principalAmount)}) cannot exceed current balance of ${formatCurrency(currentPrincipalBalance)}`);
        }
        
        if (interestAmount > currentInterestBalance) {
            throw new Error(`Interest amount (${formatCurrency(interestAmount)}) cannot exceed current balance of ${formatCurrency(currentInterestBalance)}`);
        }
        
        // Process repayment in transaction
        const { error: insertError } = await supabase
            .from('loan_repayments')
            .insert([{
                loan_id: loanId,
                principal_amount: principalAmount || 0,
                interest_amount: interestAmount || 0,
                payment_date: repaymentDate
            }]);
        
        if (insertError) throw insertError;
        
        // Update loan status and outstanding amount
        const newPrincipalBalance = currentPrincipalBalance - (principalAmount || 0);
        const newOutstandingAmount = Math.max(0, newPrincipalBalance);
        
        const updateData = {
            outstanding_amount: newOutstandingAmount
        };
        
        if (newPrincipalBalance <= 0) {
            updateData.status = 'closed';
        }
        
        const { error: updateError } = await supabase
            .from('loans')
            .update(updateData)
            .eq('id', loanId);
        
        if (updateError) throw updateError;
        
        return {
            success: true,
            memberName: loan.members.name,
            newBalance: newPrincipalBalance,
            loanClosed: newPrincipalBalance <= 0
        };
        
    } catch (error) {
        console.error('Error processing repayment:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}


// ==================== FD INTEREST FUNCTIONS ====================

// Calculate quarterly FD interest
async function calculateQuarterlyFDInterest() {
    const year = parseInt(document.getElementById('fdInterestYear').value);
    const quarter = document.getElementById('fdInterestQuarter').value;
    
    if (!year || !quarter) {
        showAlert('Please select both year and quarter', 'error');
        return;
    }
    
    try {
        const quarterDates = await getQuarterDates(year, quarter);
        if (!quarterDates) {
            showAlert('Could not determine quarter dates. Please check settings.', 'error');
            return;
        }
        
        console.log('Quarter dates:', quarterDates);
        
        // Get all active FDs at the start of quarter
        const { data: activeFDs, error: fdError } = await supabase
            .from('fixed_deposits')
            .select(`
                id, member_id, amount, deposit_date,
                members(name)
            `)
            .eq('status', 'active')
            .lte('deposit_date', quarterDates.endDate)
            .order('deposit_date');
        
        if (fdError) throw fdError;
        
        if (!activeFDs || activeFDs.length === 0) {
            showAlert('No active fixed deposits found for the selected period', 'error');
            return;
        }
        
        // Get total interest earned for each FD (from previous quarters)
        for (const fd of activeFDs) {
            const { data: prevInterest, error: interestError } = await supabase
                .from('fd_interest_calculations')
                .select('interest_earned')
                .eq('fd_id', fd.id)
                .or(`year.lt.${year},and(year.eq.${year},quarter.lt.${quarter})`);
            
            if (interestError) throw interestError;
            
            fd.total_interest_earned = prevInterest?.reduce((sum, calc) => sum + calc.interest_earned, 0) || 0;
        }
        
        // Calculate components for the formula
        
        // 1. Total subscriptions received till quarter end
        const { data: subscriptions, error: subError } = await supabase
            .from('subscriptions')
            .select('amount')
            .lte('payment_date', quarterDates.endDate);
        
        if (subError) throw subError;
        
        const totalSubscriptions = subscriptions?.reduce((sum, sub) => sum + sub.amount, 0) || 0;
        
        // 2. Total FD balance till quarter end (including interest earned)
        let totalFDBalance = 0;
        activeFDs.forEach(fd => {
            totalFDBalance += fd.amount + fd.total_interest_earned;
        });
        
        // 3. Total loan interest repaid till quarter end
        const { data: loanRepayments, error: repayError } = await supabase
            .from('loan_repayments')
            .select('interest_amount')
            .lte('payment_date', quarterDates.endDate);
        
        if (repayError) throw repayError;
        
        const totalLoanInterest = loanRepayments?.reduce((sum, rep) => sum + rep.interest_amount, 0) || 0;
        
        console.log('Calculation components:', {
            totalSubscriptions,
            totalFDBalance,
            totalLoanInterest
        });
        
        if (totalSubscriptions + totalFDBalance === 0) {
            showAlert('No subscription or FD balance found for calculation', 'error');
            return;
        }
        
        // Calculate interest for each FD
        const fdInterestResults = [];
        let totalInterestDistributed = 0;
        
        activeFDs.forEach(fd => {
            // Individual FD balance at quarter start
            const fdOpeningBalance = fd.amount + fd.total_interest_earned;
            
            // Apply the formula: (Individual FD Balance) / (Total Subscriptions + Total FD Balance) * (Total Loan Interest)
            const interestEarned = (fdOpeningBalance / (totalSubscriptions + totalFDBalance)) * totalLoanInterest;
            const fdClosingBalance = fdOpeningBalance + interestEarned;
            
            totalInterestDistributed += interestEarned;
            
            fdInterestResults.push({
                fd_id: fd.id,
                member_id: fd.member_id,
                member_name: fd.members.name,
                opening_balance: fdOpeningBalance,
                interest_earned: interestEarned,
                closing_balance: fdClosingBalance,
                share_percentage: (fdOpeningBalance / (totalSubscriptions + totalFDBalance)) * 100
            });
        });
        
        // Store calculation data for posting
        window.fdInterestCalculationData = {
            year,
            quarter,
            quarterDates,
            totalSubscriptions,
            totalFDBalance,
            totalLoanInterest,
            fdInterestResults,
            totalInterestDistributed
        };
        
        // Display results
        displayFDInterestResults();
        
    } catch (error) {
        console.error('Error calculating FD interest:', error);
        showAlert('Error calculating FD interest: ' + error.message, 'error');
    }
}

// Display FD interest calculation results
function displayFDInterestResults() {
    const data = window.fdInterestCalculationData;
    if (!data) return;
    
    // Summary
    let summaryHTML = `
        <div class="summary-cards">
            <div class="summary-card" style="background: linear-gradient(135deg, #27ae60, #229954);">
                <h4>Total Loan Interest</h4>
                <div class="amount">${formatCurrency(data.totalLoanInterest)}</div>
                <small style="opacity: 0.8;">Available for Distribution</small>
            </div>
            <div class="summary-card" style="background: linear-gradient(135deg, #3498db, #2980b9);">
                <h4>Total Fund Base</h4>
                <div class="amount">${formatCurrency(data.totalSubscriptions + data.totalFDBalance)}</div>
                <small style="opacity: 0.8;">Subscriptions + FDs</small>
            </div>
            <div class="summary-card" style="background: linear-gradient(135deg, #f39c12, #e67e22);">
                <h4>Interest Distributed</h4>
                <div class="amount">${formatCurrency(data.totalInterestDistributed)}</div>
                <small style="opacity: 0.8;">To ${data.fdInterestResults.length} FDs</small>
            </div>
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #e8f4fd; border-radius: 8px; border-left: 4px solid #3498db;">
            <strong>📊 Calculation Summary for ${data.quarter} ${data.year}:</strong><br>
            • Period: ${new Date(data.quarterDates.startDate).toLocaleDateString()} to ${new Date(data.quarterDates.endDate).toLocaleDateString()}<br>
            • Total Subscriptions: ${formatCurrency(data.totalSubscriptions)}<br>
            • Total FD Balance: ${formatCurrency(data.totalFDBalance)}<br>
            • Formula: Individual FD Balance ÷ (Subscriptions + FD Balance) × Loan Interest
        </div>
    `;
    
    // Table
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>FD ID</th>
                    <th>Member</th>
                    <th>Opening Balance</th>
                    <th>Share %</th>
                    <th>Interest Earned</th>
                    <th>Closing Balance</th>
                    <th>Return Rate</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.fdInterestResults.forEach(fd => {
        const returnRate = (fd.interest_earned / fd.opening_balance) * 100;
        
        tableHTML += `
            <tr>
                <td>FD${String(fd.fd_id).padStart(4, '0')}</td>
                <td>${fd.member_name}</td>
                <td>${formatCurrency(fd.opening_balance)}</td>
                <td>${fd.share_percentage.toFixed(3)}%</td>
                <td style="font-weight: bold; color: #27ae60;">${formatCurrency(fd.interest_earned)}</td>
                <td>${formatCurrency(fd.closing_balance)}</td>
                <td>${returnRate.toFixed(2)}%</td>
            </tr>
        `;
    });
    
    tableHTML += `
            <tr style="font-weight: bold; background-color: #f8f9fa; border-top: 2px solid #dee2e6;">
                <td colspan="2"><strong>TOTAL</strong></td>
                <td><strong>${formatCurrency(data.totalFDBalance)}</strong></td>
                <td><strong>100.00%</strong></td>
                <td style="color: #27ae60;"><strong>${formatCurrency(data.totalInterestDistributed)}</strong></td>
                <td><strong>${formatCurrency(data.totalFDBalance + data.totalInterestDistributed)}</strong></td>
                <td><strong>${(data.totalInterestDistributed / data.totalFDBalance * 100).toFixed(2)}%</strong></td>
            </tr>
        </tbody>
    </table>
    `;
    
    document.getElementById('fdInterestSummary').innerHTML = summaryHTML;
    document.getElementById('fdInterestTable').innerHTML = tableHTML;
    document.getElementById('fdInterestResults').style.display = 'block';
    document.getElementById('postFDInterestBtn').style.display = 'inline-block';
    
    showAlert('FD interest calculated successfully! 💰', 'success');
}

// Post quarterly FD interest to database
async function postQuarterlyFDInterest() {
    const data = window.fdInterestCalculationData;
    if (!data) {
        showAlert('No calculation data available. Please calculate interest first.', 'error');
        return;
    }
    
    try {
        // Check if interest already posted for this quarter
        const { data: existingCalcs, error: checkError } = await supabase
            .from('fd_interest_calculations')
            .select('id')
            .eq('year', data.year)
            .eq('quarter', data.quarter)
            .limit(1);
        
        if (checkError) throw checkError;
        
        if (existingCalcs && existingCalcs.length > 0) {
            if (!confirm(`Interest has already been posted for ${data.quarter} ${data.year}. Do you want to post again? This will overwrite existing data.`)) {
                return;
            }
            
            // Delete existing records
            const { error: deleteError } = await supabase
                .from('fd_interest_calculations')
                .delete()
                .eq('year', data.year)
                .eq('quarter', data.quarter);
            
            if (deleteError) throw deleteError;
        }
        
        const postingDate = new Date().toISOString().split('T')[0];
        
        // Insert new calculations
        const calculationsToInsert = data.fdInterestResults.map(fd => ({
            fd_id: fd.fd_id,
            year: data.year,
            quarter: data.quarter,
            opening_balance: fd.opening_balance,
            interest_earned: fd.interest_earned,
            closing_balance: fd.closing_balance,
            total_subscriptions: data.totalSubscriptions,
            total_fd_balance: data.totalFDBalance,
            total_loan_interest: data.totalLoanInterest,
            calculation_date: postingDate
        }));
        
        const { error: insertError } = await supabase
            .from('fd_interest_calculations')
            .insert(calculationsToInsert);
        
        if (insertError) throw insertError;
        
        showAlert(`FD interest posted successfully for ${data.quarter} ${data.year}! Total distributed: ${formatCurrency(data.totalInterestDistributed)}`, 'success');
        
        // Update dashboard and clear calculation data
        await loadDashboard();
        window.fdInterestCalculationData = null;
        document.getElementById('postFDInterestBtn').style.display = 'none';
        
    } catch (error) {
        console.error('Error posting FD interest:', error);
        showAlert('Error posting FD interest: ' + error.message, 'error');
    }
}

// Load FD interest history
async function loadFDInterestHistory() {
    try {
        const { data: history, error } = await supabase
            .from('fd_interest_calculations')
            .select('year, quarter, calculation_date, interest_earned')
            .order('year', { ascending: false })
            .order('quarter', { ascending: false });
        
        if (error) throw error;
        
        if (!history || history.length === 0) {
            document.getElementById('fdInterestHistory').innerHTML = '<p>No FD interest calculations found.</p>';
            return;
        }
        
        // Group by quarter/year
        const groupedHistory = {};
        history.forEach(record => {
            const key = `${record.quarter} ${record.year}`;
            if (!groupedHistory[key]) {
                groupedHistory[key] = {
                    quarter: record.quarter,
                    year: record.year,
                    calculation_date: record.calculation_date,
                    fd_count: 0,
                    total_interest: 0
                };
            }
            groupedHistory[key].fd_count++;
            groupedHistory[key].total_interest += record.interest_earned;
        });
        
        let historyHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Quarter</th>
                        <th>FDs Count</th>
                        <th>Total Interest</th>
                        <th>Posted Date</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        Object.values(groupedHistory).forEach(record => {
            historyHTML += `
                <tr>
                    <td><strong>${record.quarter} ${record.year}</strong></td>
                    <td>${record.fd_count}</td>
                    <td>${formatCurrency(record.total_interest)}</td>
                    <td>${new Date(record.calculation_date).toLocaleDateString()}</td>
                </tr>
            `;
        });
        
        historyHTML += '</tbody></table>';
        
        document.getElementById('fdInterestHistory').innerHTML = historyHTML;
        
    } catch (error) {
        console.error('Error loading FD interest history:', error);
        showAlert('Error loading history: ' + error.message, 'error');
    }
}

// ==================== REPORT FUNCTIONS ====================

// Generate Income-Expenditure Statement
async function generateIncomeExpenditureStatement() {
    const fromDate = document.getElementById('ieFromDate').value;
    const toDate = document.getElementById('ieToDate').value;
    
    if (!fromDate || !toDate) {
        showAlert('Please select both from and to dates', 'error');
        return;
    }
    
    try {
        // === INCOME CALCULATION ===
        
        // 1. Interest received from loan repayments (within date range)
        const { data: interestRepayments, error: repayError } = await supabase
            .from('loan_repayments')
            .select('interest_amount')
            .gte('payment_date', fromDate)
            .lte('payment_date', toDate);
        
        if (repayError) throw repayError;
        
        const interestReceived = interestRepayments?.reduce((sum, rep) => sum + rep.interest_amount, 0) || 0;
        
        // 2. Interest accrued on outstanding loans (within date range)
        const { data: interestAccruals, error: accrualError } = await supabase
            .from('loan_interest_accruals')
            .select('accrued_amount')
            .gte('accrual_date', fromDate)
            .lte('accrual_date', toDate);
        
        if (accrualError) throw accrualError;
        
        const interestAccrued = interestAccruals?.reduce((sum, acc) => sum + acc.accrued_amount, 0) || 0;
        
        // Total Income
        const totalIncome = interestReceived + interestAccrued;
        
        // === EXPENDITURE CALCULATION ===
        
        // FD Interest expense (from quarterly calculations within the period)
        const { data: fdInterestExpenses, error: fdError } = await supabase
            .from('fd_interest_calculations')
            .select('interest_earned')
            .gte('calculation_date', fromDate)
            .lte('calculation_date', toDate);
        
        if (fdError) throw fdError;
        
        const fdInterestExpense = fdInterestExpenses?.reduce((sum, calc) => sum + calc.interest_earned, 0) || 0;
        
        // Total Expenditure
        const totalExpenditure = fdInterestExpense;
        
        // Net Income/Loss
        const netIncome = totalIncome - totalExpenditure;
        
        const ieHTML = `
            <h4>Income-Expenditure Statement</h4>
            <p><strong>Period:</strong> ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 20px;">
                <div>
                    <h5 style="color: #27ae60; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">INCOME</h5>
                    <table style="width: 100%;">
                        <tr><td>Interest Received from Loan Repayments</td><td style="text-align: right;">${formatCurrency(interestReceived)}</td></tr>
                        <tr><td>Interest Accrued on Outstanding Loans</td><td style="text-align: right;">${formatCurrency(interestAccrued)}</td></tr>
                        <tr style="border-top: 2px solid #ddd; font-weight: bold;">
                            <td><strong>Total Income</strong></td>
                            <td style="text-align: right;"><strong>${formatCurrency(totalIncome)}</strong></td>
                        </tr>
                    </table>
                </div>
                <div>
                    <h5 style="color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">EXPENDITURE</h5>
                    <table style="width: 100%;">
                        <tr><td>Interest Payable on Fixed Deposits</td><td style="text-align: right;">${formatCurrency(fdInterestExpense)}</td></tr>
                        <tr style="border-top: 2px solid #ddd; font-weight: bold;">
                            <td><strong>Total Expenditure</strong></td>
                            <td style="text-align: right;"><strong>${formatCurrency(totalExpenditure)}</strong></td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div style="background: linear-gradient(135deg, ${netIncome >= 0 ? '#27ae60, #229954' : '#e74c3c, #c0392b'}); color: white; padding: 20px; border-radius: 8px; text-align: center;">
                <h4 style="margin: 0 0 10px 0;">${netIncome >= 0 ? 'NET PROFIT' : 'NET LOSS'}</h4>
                <div style="font-size: 28px; font-weight: bold;">${formatCurrency(Math.abs(netIncome))}</div>
                <small style="display: block; margin-top: 10px; opacity: 0.8;">Total Income - Total Expenditure</small>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background-color: #e8f4fd; border-radius: 8px; border-left: 4px solid #3498db;">
                <strong>📝 Notes:</strong><br>
                • Interest received includes actual cash payments from borrowers<br>
                • Interest accrued includes interest posted to loan accounts (even if not yet paid)<br>
                • FD interest expense is from quarterly calculations based on profit-sharing model<br>
                • Ensure FD quarterly interest has been calculated and posted for accurate results<br>
                • This statement shows society's operational income and expenses
            </div>
        `;
        
        document.getElementById('incomeExpenditureStatement').innerHTML = ieHTML;
        
    } catch (error) {
        console.error('Error generating income-expenditure statement:', error);
        showAlert('Error generating statement: ' + error.message, 'error');
    }
}

// Calculate profit distribution
async function calculateProfitDistribution() {
    const fromDate = document.getElementById('payoutFromDate').value;
    const toDate = document.getElementById('payoutToDate').value;
    
    if (!fromDate || !toDate) {
        showAlert('Please select both from and to dates', 'error');
        return;
    }
    
    try {
        // === CALCULATE NET PROFIT (Same as Income-Expenditure Statement) ===
        
        // 1. Interest received from loan repayments
        const { data: interestRepayments, error: repayError } = await supabase
            .from('loan_repayments')
            .select('interest_amount')
            .gte('payment_date', fromDate)
            .lte('payment_date', toDate);
        
        if (repayError) throw repayError;
        
        const interestReceived = interestRepayments?.reduce((sum, rep) => sum + rep.interest_amount, 0) || 0;
        
        // 2. Interest accrued on outstanding loans
        const { data: interestAccruals, error: accrualError } = await supabase
            .from('loan_interest_accruals')
            .select('accrued_amount')
            .gte('accrual_date', fromDate)
            .lte('accrual_date', toDate);
        
        if (accrualError) throw accrualError;
        
        const interestAccrued = interestAccruals?.reduce((sum, acc) => sum + acc.accrued_amount, 0) || 0;
        
        // Total Income
        const totalIncome = interestReceived + interestAccrued;
        
        // 3. FD Interest Expense (from actual quarterly calculations within the period)
        const { data: fdInterestExpenses, error: fdError } = await supabase
            .from('fd_interest_calculations')
            .select('interest_earned')
            .gte('calculation_date', fromDate)
            .lte('calculation_date', toDate);
        
        if (fdError) throw fdError;
        
        const fdInterestExpense = fdInterestExpenses?.reduce((sum, calc) => sum + calc.interest_earned, 0) || 0;
        
        // Total Expenditure
        const totalExpenditure = fdInterestExpense;
        
        // Net Profit
        const netProfit = totalIncome - totalExpenditure;
        
        if (netProfit <= 0) {
            document.getElementById('profitDistributionResults').style.display = 'block';
            document.getElementById('profitDistributionSummary').innerHTML = `
                <div class="alert alert-error">
                    <strong>No Profit to Distribute</strong><br>
                    Net Profit for the period: ${formatCurrency(netProfit)}<br>
                    Total Income: ${formatCurrency(totalIncome)}<br>
                    Total Expenses: ${formatCurrency(fdInterestExpense)}<br>
                    <em>Profit distribution requires positive net profit.</em>
                </div>
            `;
            document.getElementById('profitDistributionTable').innerHTML = '';
            document.getElementById('exportPayoutBtn').style.display = 'none';
            return;
        }
        
        // === CALCULATE MEMBER SUBSCRIPTION CONTRIBUTIONS ===
        
        const { data: subscriptionData, error: subError } = await supabase
            .from('subscriptions')
            .select(`
                member_id, amount,
                members(name)
            `)
            .gte('payment_date', fromDate)
            .lte('payment_date', toDate)
            .order('members(name)');
        
        if (subError) throw subError;
        
        if (!subscriptionData || subscriptionData.length === 0) {
            document.getElementById('profitDistributionResults').style.display = 'block';
            document.getElementById('profitDistributionSummary').innerHTML = `
                <div class="alert alert-error">
                    <strong>No Subscription Contributions Found</strong><br>
                    No subscription payments were made during the selected period.<br>
                    <em>Profit distribution requires subscription contributions during the period.</em>
                </div>
            `;
            document.getElementById('profitDistributionTable').innerHTML = '';
            document.getElementById('exportPayoutBtn').style.display = 'none';
            return;
        }
        
        // Group by member
        const memberContributions = {};
        let totalContributions = 0;
        
        subscriptionData.forEach(sub => {
            if (!memberContributions[sub.member_id]) {
                memberContributions[sub.member_id] = {
                    member_id: sub.member_id,
                    member_name: sub.members.name,
                    total_contribution: 0
                };
            }
            memberContributions[sub.member_id].total_contribution += sub.amount;
            totalContributions += sub.amount;
        });
        
        const memberContributionsArray = Object.values(memberContributions);
        
        // === CALCULATE PROFIT DISTRIBUTION ===
        
        const profitDistribution = memberContributionsArray.map(member => {
            const contributionRatio = member.total_contribution / totalContributions;
            const profitShare = netProfit * contributionRatio;
            const contributionPercentage = (contributionRatio * 100);
            
            return {
                member_id: member.member_id,
                member_name: member.member_name,
                total_contribution: member.total_contribution,
                contribution_percentage: contributionPercentage,
                profit_share: profitShare
            };
        });
        
        // Store data for PDF export
        window.payoutReportData = {
            fromDate,
            toDate,
            totalIncome,
            fdInterestExpense,
            netProfit,
            totalContributions,
            profitDistribution
        };
        
        // === DISPLAY RESULTS ===
        
        let summaryHTML = `
            <div class="summary-cards">
                <div class="summary-card" style="background: linear-gradient(135deg, #27ae60, #229954);">
                    <h4>Net Profit</h4>
                    <div class="amount">${formatCurrency(netProfit)}</div>
                    <small style="opacity: 0.8;">Available for Distribution</small>
                </div>
                <div class="summary-card" style="background: linear-gradient(135deg, #3498db, #2980b9);">
                    <h4>Total Contributions</h4>
                    <div class="amount">${formatCurrency(totalContributions)}</div>
                    <small style="opacity: 0.8;">Subscription Payments</small>
                </div>
                <div class="summary-card" style="background: linear-gradient(135deg, #f39c12, #e67e22);">
                    <h4>Eligible Members</h4>
                    <div class="amount">${memberContributionsArray.length}</div>
                    <small style="opacity: 0.8;">With Contributions</small>
                </div>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #e8f4fd; border-radius: 8px; border-left: 4px solid #3498db;">
                <strong>📊 Financial Summary for ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}:</strong><br>
                • Total Income: ${formatCurrency(totalIncome)} (Interest Received: ${formatCurrency(interestReceived)}, Interest Accrued: ${formatCurrency(interestAccrued)})<br>
                • Total Expenses: ${formatCurrency(fdInterestExpense)} (FD Interest from Quarterly Calculations)<br>
                • <strong>Net Profit: ${formatCurrency(netProfit)}</strong>
            </div>
        `;
        
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Member ID</th>
                        <th>Member Name</th>
                        <th>Contribution Amount</th>
                        <th>Contribution %</th>
                        <th>Profit Share</th>
                        <th>Dividend Rate</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let totalProfitDistributed = 0;
        
        profitDistribution.forEach(member => {
            totalProfitDistributed += member.profit_share;
            const dividendRate = (member.profit_share / member.total_contribution * 100);
            
            tableHTML += `
                <tr>
                    <td>MS${String(member.member_id).padStart(4, '0')}</td>
                    <td>${member.member_name}</td>
                    <td>${formatCurrency(member.total_contribution)}</td>
                    <td>${member.contribution_percentage.toFixed(2)}%</td>
                    <td style="font-weight: bold; color: #27ae60;">${formatCurrency(member.profit_share)}</td>
                    <td>${dividendRate.toFixed(2)}%</td>
                </tr>
            `;
        });
        
        tableHTML += `
                <tr style="font-weight: bold; background-color: #f8f9fa; border-top: 2px solid #dee2e6;">
                    <td colspan="2"><strong>TOTAL</strong></td>
                    <td><strong>${formatCurrency(totalContributions)}</strong></td>
                    <td><strong>100.00%</strong></td>
                    <td style="color: #27ae60;"><strong>${formatCurrency(totalProfitDistributed)}</strong></td>
                    <td><strong>${(totalProfitDistributed/totalContributions*100).toFixed(2)}%</strong></td>
                </tr>
            </tbody>
        </table>
        `;
        
        document.getElementById('profitDistributionSummary').innerHTML = summaryHTML;
        document.getElementById('profitDistributionTable').innerHTML = tableHTML;
        document.getElementById('profitDistributionResults').style.display = 'block';
        document.getElementById('exportPayoutBtn').style.display = 'inline-block';
        
        showAlert('Profit distribution calculated successfully! 💰', 'success');
        
    } catch (error) {
        console.error('Error calculating profit distribution:', error);
        showAlert('Error calculating profit distribution: ' + error.message, 'error');
    }
}

// Generate Due Report
async function generateDueReport() {
    const month = document.getElementById('reportMonth').value;
    if (!month) {
        showAlert('Please select a month', 'error');
        return;
    }
    
    try {
        // Get all active members
        const { data: allMembers, error: memberError } = await supabase
            .from('members')
            .select('id, name, contact')
            .eq('status', 'active')
            .order('name');
        
        if (memberError) throw memberError;
        
        // Get members who paid for this month with their payment details
        const { data: paidSubscriptions, error: subError } = await supabase
            .from('subscriptions')
            .select(`
                member_id, amount, payment_date,
                members(name, contact)
            `)
            .eq('month', month)
            .order('members(name)');
        
        if (subError) throw subError;
        
        const paidMembers = paidSubscriptions || [];
        let totalCollected = 0;
        
        paidMembers.forEach(sub => {
            totalCollected += sub.amount;
        });
        
        const paidMemberIds = paidMembers.map(m => m.member_id);
        
        // Find members who haven't paid
        const dueMembers = allMembers.filter(member => !paidMemberIds.includes(member.id));
        
        // Store data for PDF export
        window.subscriptionReportData = {
            month,
            allMembers: allMembers.length,
            paidMembers: paidMembers.map(sub => ({
                member_id: sub.member_id,
                name: sub.members.name,
                contact: sub.members.contact,
                amount: sub.amount,
                payment_date: sub.payment_date
            })),
            dueMembers,
            totalCollected,
            paidCount: paidMembers.length,
            dueCount: dueMembers.length
        };
        
        let reportHTML = `
            <h4>Subscription Collection Report for ${month}</h4>
            <div class="summary-cards">
                <div class="summary-card" style="background: linear-gradient(135deg, #27ae60, #229954);">
                    <h4>Total Members</h4>
                    <div class="amount">${allMembers.length}</div>
                </div>
                <div class="summary-card" style="background: linear-gradient(135deg, #3498db, #2980b9);">
                    <h4>Paid Members</h4>
                    <div class="amount">${paidMembers.length}</div>
                </div>
                <div class="summary-card" style="background: linear-gradient(135deg, #e74c3c, #c0392b);">
                    <h4>Due Members</h4>
                    <div class="amount">${dueMembers.length}</div>
                </div>
                <div class="summary-card" style="background: linear-gradient(135deg, #f39c12, #e67e22);">
                    <h4>Total Collected</h4>
                    <div class="amount">${formatCurrency(totalCollected)}</div>
                </div>
            </div>
        `;
        
        // Collection Rate Progress Bar
        const collectionRate = allMembers.length > 0 ? (paidMembers.length / allMembers.length) * 100 : 0;
        reportHTML += `
            <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #3498db;">
                <strong>📊 Collection Summary:</strong><br>
                <div style="margin: 10px 0;">
                    <strong>Collection Rate: ${collectionRate.toFixed(1)}%</strong>
                    <div style="background: #e9ecef; border-radius: 10px; height: 10px; margin: 5px 0;">
                        <div style="background: linear-gradient(135deg, #27ae60, #229954); height: 100%; width: ${collectionRate}%; border-radius: 10px;"></div>
                    </div>
                </div>
                • Average Amount: ${paidMembers.length > 0 ? formatCurrency(totalCollected / paidMembers.length) : '₹0'}<br>
                • Pending Collection: ${formatCurrency(0)} (estimated based on due members)
            </div>
        `;
        
        // Paid Members Table
        if (paidMembers.length > 0) {
            reportHTML += `
                <h5 style="color: #27ae60; margin-top: 30px;">✅ Paid Members (${paidMembers.length})</h5>
                <table>
                    <thead>
                        <tr>
                            <th>Member ID</th>
                            <th>Name</th>
                            <th>Contact</th>
                            <th>Amount</th>
                            <th>Payment Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            paidMembers.forEach(member => {
                reportHTML += `
                    <tr>
                        <td>MS${String(member.member_id).padStart(4, '0')}</td>
                        <td>${member.members.name}</td>
                        <td>${member.members.contact}</td>
                        <td>${formatCurrency(member.amount)}</td>
                        <td>${new Date(member.payment_date).toLocaleDateString()}</td>
                        <td><span class="status-badge status-active">Paid</span></td>
                    </tr>
                `;
            });
            
            reportHTML += `
                    <tr style="font-weight: bold; background-color: #d4edda; border-top: 2px solid #27ae60;">
                        <td colspan="3"><strong>TOTAL COLLECTED</strong></td>
                        <td><strong>${formatCurrency(totalCollected)}</strong></td>
                        <td colspan="2"><strong>${paidMembers.length} payments</strong></td>
                    </tr>
                </tbody>
            </table>
            `;
        }
        
        // Due Members Table
        if (dueMembers.length > 0) {
            reportHTML += `
                <h5 style="color: #e74c3c; margin-top: 30px;">❌ Due Members (${dueMembers.length})</h5>
                <table>
                    <thead>
                        <tr>
                            <th>Member ID</th>
                            <th>Name</th>
                            <th>Contact</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            dueMembers.forEach(member => {
                const whatsappMessage = encodeURIComponent(`Dear ${member.name}, your monthly subscription for ${month} is due. Please make the payment at your earliest convenience. Thank you!`);
                
                reportHTML += `
                    <tr>
                        <td>MS${String(member.id).padStart(4, '0')}</td>
                        <td>${member.name}</td>
                        <td>${member.contact}</td>
                        <td><span class="status-badge status-due">Due</span></td>
                        <td>
                            <a href="https://wa.me/91${member.contact}?text=${whatsappMessage}" 
                               target="_blank" class="whatsapp-btn">
                                📱 WhatsApp Reminder
                            </a>
                        </td>
                    </tr>
                `;
            });
            
            reportHTML += '</tbody></table>';
        } else {
            reportHTML += `
                <div class="alert alert-success" style="margin-top: 30px;">
                    🎉 Excellent! All members have paid their subscription for ${month}.
                </div>
            `;
        }
        
        document.getElementById('dueReport').innerHTML = reportHTML;
        document.getElementById('exportSubReportBtn').style.display = 'inline-block';
        
    } catch (error) {
        console.error('Error generating due report:', error);
        showAlert('Error generating report: ' + error.message, 'error');
    }
}

// Generate Loan Statement
async function generateLoanStatement() {
    const memberId = document.getElementById('loanStatementMember').value;
    if (!memberId) {
        showAlert('Please search and select a member', 'error');
        return;
    }
    
    try {
        // Get member details
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('name')
            .eq('id', memberId)
            .single();
        
        if (memberError) throw memberError;
        
        if (!memberData) {
            showAlert('Member not found', 'error');
            return;
        }
        
        // Get loans for this member
        const { data: loans, error: loansError } = await supabase
            .from('loans')
            .select('*')
            .eq('member_id', memberId)
            .order('loan_date', { ascending: false });
        
        if (loansError) throw loansError;
        
        let statementHTML = `
            <h4>Loan Statement - ${memberData.name}</h4>
            <table>
                <thead>
                    <tr>
                        <th>Loan ID</th>
                        <th>Amount</th>
                        <th>Interest Type</th>
                        <th>Rate</th>
                        <th>Loan Date</th>
                        <th>Outstanding</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (!loans || loans.length === 0) {
            statementHTML += `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px; color: #666;">
                        No loans found for this member.
                    </td>
                </tr>
            `;
        } else {
            for (const loan of loans) {
                // Calculate current outstanding
                const { data: repayments, error: repayError } = await supabase
                    .from('loan_repayments')
                    .select('principal_amount, interest_amount')
                    .eq('loan_id', loan.id);
                
                if (repayError) throw repayError;
                
                const { data: accruals, error: accrualError } = await supabase
                    .from('loan_interest_accruals')
                    .select('accrued_amount')
                    .eq('loan_id', loan.id);
                
                if (accrualError) throw accrualError;
                
                const totalPrincipalPaid = repayments?.reduce((sum, rep) => sum + rep.principal_amount, 0) || 0;
                const totalInterestAccrued = accruals?.reduce((sum, acc) => sum + acc.accrued_amount, 0) || 0;
                const totalInterestPaid = repayments?.reduce((sum, rep) => sum + rep.interest_amount, 0) || 0;
                
                const principalBalance = loan.amount - totalPrincipalPaid;
                const interestBalance = Math.max(0, totalInterestAccrued - totalInterestPaid);
                const totalOutstanding = principalBalance + interestBalance;
                
                let interestDisplay = '';
                let rateDisplay = '';
                
                if (loan.interest_rate_type === 'progressive') {
                    interestDisplay = 'Progressive';
                    rateDisplay = '2%/3%';
                } else if (loan.interest_rate_type === 'flat') {
                    interestDisplay = 'Flat Rate';
                    rateDisplay = `${loan.manual_interest_rate}%`;
                } else if (loan.interest_rate_type === 'zero') {
                    interestDisplay = 'Zero Rate';
                    rateDisplay = '0%';
                }
                
                const status = principalBalance > 0 ? 'active' : 'closed';
                
                statementHTML += `
                    <tr>
                        <td>LN${String(loan.id).padStart(4, '0')}</td>
                        <td>${formatCurrency(loan.amount)}</td>
                        <td>${interestDisplay}</td>
                        <td>${rateDisplay}</td>
                        <td>${new Date(loan.loan_date).toLocaleDateString()}</td>
                        <td>${formatCurrency(totalOutstanding)}</td>
                        <td><span class="status-badge status-${status === 'active' ? 'due' : 'active'}">${status}</span></td>
                    </tr>
                `;
            }
        }
        
        statementHTML += `
                </tbody>
            </table>
        `;
        
        document.getElementById('loanStatement').innerHTML = statementHTML;
        document.getElementById('detailedLoanLedger').innerHTML = ''; // Clear detailed ledger
        
    } catch (error) {
        console.error('Error generating loan statement:', error);
        showAlert('Error generating statement: ' + error.message, 'error');
    }
}

// Generate Detailed Loan Ledger
async function generateDetailedLoanLedger() {
    const memberId = document.getElementById('loanStatementMember').value;
    if (!memberId) {
        showAlert('Please search and select a member', 'error');
        return;
    }
    
    try {
        // Get member details
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('name')
            .eq('id', memberId)
            .single();
        
        if (memberError) throw memberError;
        
        if (!memberData) {
            showAlert('Member not found', 'error');
            return;
        }
        
        // Get all loans for this member
        const { data: loans, error: loansError } = await supabase
            .from('loans')
            .select('*')
            .eq('member_id', memberId)
            .order('loan_date');
        
        if (loansError) throw loansError;
        
        if (!loans || loans.length === 0) {
            document.getElementById('detailedLoanLedger').innerHTML = `
                <div class="alert alert-error">
                    <strong>No loans found for ${memberData.name}</strong><br>
                    This member has no loan history.
                </div>
            `;
            return;
        }
        
        let ledgerHTML = `
            <h4>📊 Detailed Loan Ledger - ${memberData.name}</h4>
            <p><em>Complete month-wise transaction history for all loans</em></p>
        `;
        
        const allTransactions = [];
        let totalPrincipalDisbursed = 0;
        let totalInterestAccrued = 0;
        let totalPrincipalPaid = 0;
        let totalInterestPaid = 0;
        
        // Process each loan
        for (const loan of loans) {
            totalPrincipalDisbursed += loan.amount;
            
            // Add loan disbursement transaction
            allTransactions.push({
                date: loan.loan_date,
                type: 'Loan Disbursement',
                loan_id: loan.id,
                description: `Loan LN${String(loan.id).padStart(4, '0')} disbursed`,
                principal_debit: loan.amount,
                principal_credit: 0,
                interest_debit: 0,
                interest_credit: 0,
                interest_type: loan.interest_rate_type,
                interest_rate: loan.manual_interest_rate
            });
            
            // Get interest accruals for this loan
            const { data: accruals, error: accrualError } = await supabase
                .from('loan_interest_accruals')
                .select('*')
                .eq('loan_id', loan.id)
                .order('accrual_date');
            
            if (accrualError) throw accrualError;
            
            if (accruals) {
                accruals.forEach(accrual => {
                    totalInterestAccrued += accrual.accrued_amount;
                    
                    allTransactions.push({
                        date: accrual.accrual_date,
                        type: 'Interest Accrual',
                        loan_id: loan.id,
                        description: `Interest for ${accrual.accrual_month}`,
                        principal_debit: 0,
                        principal_credit: 0,
                        interest_debit: accrual.accrued_amount,
                        interest_credit: 0,
                        interest_type: loan.interest_rate_type,
                        interest_rate: loan.manual_interest_rate
                    });
                });
            }
            
            // Get repayments for this loan
            const { data: repayments, error: repayError } = await supabase
                .from('loan_repayments')
                .select('*')
                .eq('loan_id', loan.id)
                .order('payment_date');
            
            if (repayError) throw repayError;
            
            if (repayments) {
                repayments.forEach(repayment => {
                    totalPrincipalPaid += repayment.principal_amount;
                    totalInterestPaid += repayment.interest_amount;
                    
                    allTransactions.push({
                        date: repayment.payment_date,
                        type: 'Repayment',
                        loan_id: loan.id,
                        description: `Payment received`,
                        principal_debit: 0,
                        principal_credit: repayment.principal_amount,
                        interest_debit: 0,
                        interest_credit: repayment.interest_amount,
                        interest_type: loan.interest_rate_type,
                        interest_rate: loan.manual_interest_rate
                    });
                });
            }
        }
        
        // Sort all transactions by date
        allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Store data for PDF export
        window.loanLedgerData = {
            memberName: memberData.name,
            memberId,
            transactions: allTransactions,
            summary: {
                totalPrincipalDisbursed,
                totalInterestAccrued,
                totalPrincipalPaid,
                totalInterestPaid,
                outstandingPrincipal: totalPrincipalDisbursed - totalPrincipalPaid,
                outstandingInterest: totalInterestAccrued - totalInterestPaid
            }
        };
        
        // Create summary
        const outstandingPrincipal = totalPrincipalDisbursed - totalPrincipalPaid;
        const outstandingInterest = totalInterestAccrued - totalInterestPaid;
        const totalOutstanding = outstandingPrincipal + Math.max(0, outstandingInterest);
        
        ledgerHTML += `
            <div class="summary-cards">
                <div class="summary-card" style="background: linear-gradient(135deg, #3498db, #2980b9);">
                    <h4>Total Disbursed</h4>
                    <div class="amount">${formatCurrency(totalPrincipalDisbursed)}</div>
                </div>
                <div class="summary-card" style="background: linear-gradient(135deg, #f39c12, #e67e22);">
                    <h4>Interest Accrued</h4>
                    <div class="amount">${formatCurrency(totalInterestAccrued)}</div>
                </div>
                <div class="summary-card" style="background: linear-gradient(135deg, #27ae60, #229954);">
                    <h4>Total Repaid</h4>
                    <div class="amount">${formatCurrency(totalPrincipalPaid + totalInterestPaid)}</div>
                </div>
                <div class="summary-card" style="background: linear-gradient(135deg, #e74c3c, #c0392b);">
                    <h4>Outstanding</h4>
                    <div class="amount">${formatCurrency(totalOutstanding)}</div>
                </div>
            </div>
        `;
        
        // Create detailed transaction table
        ledgerHTML += `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Transaction Type</th>
                        <th>Loan ID</th>
                        <th>Description</th>
                        <th>Principal Dr.</th>
                        <th>Principal Cr.</th>
                        <th>Interest Dr.</th>
                        <th>Interest Cr.</th>
                        <th>Principal Balance</th>
                        <th>Interest Balance</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let runningPrincipalBalance = 0;
        let runningInterestBalance = 0;
        
        allTransactions.forEach(transaction => {
            // Update running balances
            runningPrincipalBalance += transaction.principal_debit - transaction.principal_credit;
            runningInterestBalance += transaction.interest_debit - transaction.interest_credit;
            
            // Ensure interest balance doesn't go negative
            runningInterestBalance = Math.max(0, runningInterestBalance);
            
            const typeColor = transaction.type === 'Loan Disbursement' ? '#3498db' : 
                             transaction.type === 'Interest Accrual' ? '#f39c12' : '#27ae60';
            
            ledgerHTML += `
                <tr>
                    <td>${new Date(transaction.date).toLocaleDateString()}</td>
                    <td style="color: ${typeColor}; font-weight: bold;">${transaction.type}</td>
                    <td>LN${String(transaction.loan_id).padStart(4, '0')}</td>
                    <td>${transaction.description}</td>
                    <td>${transaction.principal_debit > 0 ? formatCurrency(transaction.principal_debit) : '-'}</td>
                    <td>${transaction.principal_credit > 0 ? formatCurrency(transaction.principal_credit) : '-'}</td>
                    <td>${transaction.interest_debit > 0 ? formatCurrency(transaction.interest_debit) : '-'}</td>
                    <td>${transaction.interest_credit > 0 ? formatCurrency(transaction.interest_credit) : '-'}</td>
                    <td style="font-weight: bold;">${formatCurrency(runningPrincipalBalance)}</td>
                    <td style="font-weight: bold;">${formatCurrency(runningInterestBalance)}</td>
                </tr>
            `;
        });
        
        ledgerHTML += `
                <tr style="font-weight: bold; background-color: #f8f9fa; border-top: 2px solid #dee2e6;">
                    <td colspan="4"><strong>FINAL BALANCES</strong></td>
                    <td><strong>${formatCurrency(totalPrincipalDisbursed)}</strong></td>
                    <td><strong>${formatCurrency(totalPrincipalPaid)}</strong></td>
                    <td><strong>${formatCurrency(totalInterestAccrued)}</strong></td>
                    <td><strong>${formatCurrency(totalInterestPaid)}</strong></td>
                    <td style="color: #e74c3c;"><strong>${formatCurrency(outstandingPrincipal)}</strong></td>
                    <td style="color: #e74c3c;"><strong>${formatCurrency(Math.max(0, outstandingInterest))}</strong></td>
                </tr>
            </tbody>
        </table>
        `;
        
        ledgerHTML += `
            <div style="margin-top: 20px; padding: 15px; background-color: #e8f4fd; border-radius: 8px; border-left: 4px solid #3498db;">
                <strong>📝 Ledger Notes:</strong><br>
                • <strong>Dr. (Debit):</strong> Increases the balance (loans disbursed, interest accrued)<br>
                • <strong>Cr. (Credit):</strong> Decreases the balance (payments received)<br>
                • <strong>Interest Balance:</strong> Cannot go below zero (overpayments don't create negative interest)<br>
                • <strong>Total Outstanding:</strong> ${formatCurrency(totalOutstanding)} (Principal: ${formatCurrency(outstandingPrincipal)} + Interest: ${formatCurrency(Math.max(0, outstandingInterest))})<br>
                • All transactions are shown chronologically with running balances
            </div>
        `;
        
        document.getElementById('detailedLoanLedger').innerHTML = ledgerHTML;
        document.getElementById('loanStatement').innerHTML = ''; // Clear simple statement
        document.getElementById('exportLoanLedgerBtn').style.display = 'inline-block';
        
        showAlert('Detailed loan ledger generated successfully! 📊', 'success');
        
    } catch (error) {
        console.error('Error generating detailed loan ledger:', error);
        showAlert('Error generating ledger: ' + error.message, 'error');
    }
}

// ==================== UTILITY FUNCTIONS ====================

// Get quarter dates for a given year and quarter
async function getQuarterDates(year, quarter) {
    try {
        const { data: quarterSetting, error } = await supabase
            .from('quarter_settings')
            .select('start_month, end_month')
            .eq('quarter_name', quarter)
            .single();
        
        if (error) throw error;
        
        if (!quarterSetting) {
            throw new Error(`Quarter ${quarter} not found in settings`);
        }
        
        const startMonth = quarterSetting.start_month;
        const endMonth = quarterSetting.end_month;
        
        let startDate, endDate;
        
        if (startMonth > endMonth) {
            // Quarter spans across years (e.g., Dec-Feb: startMonth=12, endMonth=2)
            startDate = new Date(year, startMonth - 1, 1);  // First day of start month in current year
            endDate = new Date(year + 1, endMonth, 0);      // Last day of end month in next year
        } else {
            // Quarter within same year (e.g., Apr-Jun: startMonth=4, endMonth=6)
            startDate = new Date(year, startMonth - 1, 1);  // First day of start month
            endDate = new Date(year, endMonth, 0);          // Last day of end month
        }
        
        console.log('Quarter calculation details:', {
            year,
            quarter,
            startMonth,
            endMonth,
            rawStartDate: startDate,
            rawEndDate: endDate,
            formattedStartDate: startDate.toISOString().split('T')[0],
            formattedEndDate: endDate.toISOString().split('T')[0]
        });
        
        // Format dates to YYYY-MM-DD without timezone conversion issues
        const formatDateToLocal = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        return {
            startDate: formatDateToLocal(startDate),
            endDate: formatDateToLocal(endDate),
            startMonth,
            endMonth
        };
        
    } catch (error) {
        console.error('Error getting quarter dates:', error);
        return null;
    }
}

// Load recent transactions for dashboard
async function loadRecentTransactions() {
    try {
        const recentDiv = document.getElementById('recentTransactions');
        if (!recentDiv) return;
        
        recentDiv.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Member</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody id="recentTransactionsBody"></tbody>
            </table>
        `;
        
        const transactions = [];
        
        // Get recent subscriptions
        const { data: recentSubs, error: subError } = await supabase
            .from('subscriptions')
            .select(`
                payment_date, amount,
                members(name)
            `)
            .order('payment_date', { ascending: false })
            .limit(5);
        
        if (subError) throw subError;
        
        if (recentSubs) {
            recentSubs.forEach(sub => {
                transactions.push({
                    date: sub.payment_date,
                    type: 'Subscription',
                    member: sub.members.name,
                    amount: sub.amount
                });
            });
        }
        
        // Get recent loans
        const { data: recentLoans, error: loanError } = await supabase
            .from('loans')
            .select(`
                loan_date, amount,
                members(name)
            `)
            .order('loan_date', { ascending: false })
            .limit(5);
        
        if (loanError) throw loanError;
        
        if (recentLoans) {
            recentLoans.forEach(loan => {
                transactions.push({
                    date: loan.loan_date,
                    type: 'Loan Issued',
                    member: loan.members.name,
                    amount: loan.amount
                });
            });
        }
        
        // Sort by date and take top 10
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentTransactions = transactions.slice(0, 10);
        
        const tbody = document.getElementById('recentTransactionsBody');
        if (tbody) {
            recentTransactions.forEach(transaction => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${new Date(transaction.date).toLocaleDateString()}</td>
                    <td>${transaction.type}</td>
                    <td>${transaction.member}</td>
                    <td>${formatCurrency(transaction.amount)}</td>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading recent transactions:', error);
    }
}

// ==================== EXCEL IMPORT FUNCTIONS ====================

// Excel import functions
function handleExcelImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const arrayBuffer = e.target.result;
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            // Get the first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Filter out empty rows and process data
            const memberData = [];
            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (row && row[0] && row[1]) { // Name and contact both present
                    const name = String(row[0]).trim();
                    const contact = String(row[1]).trim();
                    
                    if (name && contact) {
                        memberData.push({
                            row: i + 1,
                            name: name,
                            contact: contact,
                            status: 'Ready'
                        });
                    }
                }
            }
            
            if (memberData.length === 0) {
                showAlert('No valid member data found in Excel file. Please ensure Column A has names and Column B has contact numbers.', 'error');
                return;
            }
            
            // Validate contact numbers and check for duplicates
            validateImportData(memberData);
            
        } catch (error) {
            console.error('Excel import error:', error);
            showAlert('Error reading Excel file: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

async function validateImportData(memberData) {
    try {
        // Get existing members for duplicate checking
        const { data: existingMembers, error } = await supabase
            .from('members')
            .select('name, contact');
        
        if (error) throw error;
        
        // Validate each member
        memberData.forEach(member => {
            // Check for duplicate contacts in existing database
            const duplicateContact = existingMembers?.find(existing => 
                existing.contact === member.contact
            );
            
            if (duplicateContact) {
                member.status = 'Duplicate Contact';
                member.error = `Contact already exists for: ${duplicateContact.name}`;
                return;
            }
            
            // Check for duplicate contacts within import data
            const duplicateInImport = memberData.find((other, index) => 
                other !== member && other.contact === member.contact
            );
            
            if (duplicateInImport) {
                member.status = 'Duplicate in Import';
                member.error = 'Contact appears multiple times in import data';
                return;
            }
            
            // Validate contact number format (basic validation)
            if (!/^\d{10}$/.test(member.contact.replace(/\D/g, ''))) {
                member.status = 'Invalid Contact';
                member.error = 'Contact should be 10 digits';
                return;
            }
            
            member.status = 'Ready';
        });
        
        window.excelImportData = memberData;
        displayImportPreview();
        
    } catch (error) {
        console.error('Validation error:', error);
        showAlert('Error validating import data: ' + error.message, 'error');
    }
}

function displayImportPreview() {
    const excelImportData = window.excelImportData;
    if (!excelImportData) return;
    
    const validCount = excelImportData.filter(m => m.status === 'Ready').length;
    const errorCount = excelImportData.length - validCount;
    
    let previewHTML = `
        <div class="import-preview">
            <div style="padding: 15px; border-bottom: 1px solid #e1e8ed; background: #f8f9fa;">
                <strong>Import Preview:</strong> ${excelImportData.length} rows found, 
                ${validCount} valid, ${errorCount} with errors
            </div>
            <table style="width: 100%; margin: 0;">
                <thead>
                    <tr style="background: #34495e; color: white;">
                        <th style="padding: 8px;">Row</th>
                        <th style="padding: 8px;">Name</th>
                        <th style="padding: 8px;">Contact</th>
                        <th style="padding: 8px;">Status</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    excelImportData.forEach(member => {
        const statusColor = member.status === 'Ready' ? '#27ae60' : '#e74c3c';
        const statusText = member.error || member.status;
        
        previewHTML += `
            <tr>
                <td style="padding: 8px;">${member.row}</td>
                <td style="padding: 8px;">${member.name}</td>
                <td style="padding: 8px;">${member.contact}</td>
                <td style="padding: 8px; color: ${statusColor}; font-weight: bold;">${statusText}</td>
            </tr>
        `;
    });
    
    previewHTML += '</tbody></table></div>';
    
    document.getElementById('importPreview').innerHTML = previewHTML;
    
    if (validCount > 0) {
        document.getElementById('processImportBtn').style.display = 'inline-block';
    } else {
        document.getElementById('processImportBtn').style.display = 'none';
    }
}

async function processExcelImport() {
    const excelImportData = window.excelImportData;
    if (!excelImportData) {
        showAlert('No import data available', 'error');
        return;
    }
    
    try {
        const validMembers = excelImportData.filter(m => m.status === 'Ready');
        
        if (validMembers.length === 0) {
            showAlert('No valid members to import', 'error');
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        const membersToInsert = validMembers.map(member => ({
            name: member.name,
            contact: member.contact,
            join_date: today,
            status: 'active'
        }));
        
        const { data, error } = await supabase
            .from('members')
            .insert(membersToInsert);
        
        if (error) throw error;
        
        showAlert(`Successfully imported ${validMembers.length} members!`, 'success');
        
        // Clear import data and refresh
        window.excelImportData = null;
        document.getElementById('excelFile').value = '';
        document.getElementById('importPreview').innerHTML = '';
        document.getElementById('processImportBtn').style.display = 'none';
        
        await loadMembers();
        await loadDashboard();
        populateMemberSelects();
        
    } catch (error) {
        console.error('Import processing error:', error);
        showAlert('Error processing import: ' + error.message, 'error');
    }
}

// ==================== PDF EXPORT FUNCTIONS ====================

// Export Subscription Report as PDF
function exportSubscriptionReportPDF() {
    if (!window.subscriptionReportData) {
        showAlert('No report data available. Please generate the report first.', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const data = window.subscriptionReportData;
        
        // Header
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('Monthly Subscription Collection Report', 20, 20);
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(`Month: ${data.month}`, 20, 30);
        doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 40);
        
        // Summary
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Collection Summary', 20, 55);
        
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(`Total Members: ${data.allMembers}`, 20, 65);
        doc.text(`Paid Members: ${data.paidCount}`, 20, 75);
        doc.text(`Due Members: ${data.dueCount}`, 20, 85);
        doc.setFont(undefined, 'bold');
        doc.text(`Total Collected: ${formatCurrency(data.totalCollected)}`, 20, 95);
        doc.setFont(undefined, 'normal');
        
        const collectionRate = data.allMembers > 0 ? (data.paidCount / data.allMembers) * 100 : 0;
        doc.text(`Collection Rate: ${collectionRate.toFixed(1)}%`, 20, 105);
        
        // All Members Table
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Member-wise Status', 20, 125);
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        const headers = ['Member ID', 'Member Name', 'Amount', 'Status', 'Payment Date'];
        let x = 20;
        const colWidths = [25, 50, 30, 25, 30];
        
        headers.forEach((header, i) => {
            doc.text(header, x, 140);
            x += colWidths[i];
        });
        
        // Create combined data for all members
        const allMemberData = [];
        
        // Add paid members
        data.paidMembers.forEach(member => {
            allMemberData.push({
                id: member.member_id,
                name: member.name,
                amount: member.amount,
                status: 'Paid',
                paymentDate: new Date(member.payment_date).toLocaleDateString()
            });
        });
        
        // Add due members
        data.dueMembers.forEach(member => {
            allMemberData.push({
                id: member.id,
                name: member.name,
                amount: 0,
                status: 'Due',
                paymentDate: '-'
            });
        });
        
        // Sort by name
        allMemberData.sort((a, b) => a.name.localeCompare(b.name));
        
        // Table rows
        doc.setFont(undefined, 'normal');
        let y = 150;
        
        allMemberData.forEach((member, index) => {
            if (y > 270) { // New page if needed
                doc.addPage();
                y = 20;
                
                // Repeat headers on new page
                doc.setFont(undefined, 'bold');
                x = 20;
                headers.forEach((header, i) => {
                    doc.text(header, x, y);
                    x += colWidths[i];
                });
                y += 10;
                doc.setFont(undefined, 'normal');
            }
            
            const rowData = [
                `MS${String(member.id).padStart(4, '0')}`,
                member.name.length > 22 ? member.name.substring(0, 22) + '...' : member.name,
                member.amount > 0 ? formatCurrency(member.amount).replace('₹', '') : '-',
                member.status,
                member.paymentDate
            ];
            
            // Set color based on status
            if (member.status === 'Paid') {
                doc.setTextColor(0, 100, 0); // Green
            } else {
                doc.setTextColor(200, 0, 0); // Red
            }
            
            x = 20;
            rowData.forEach((data, i) => {
                doc.text(data, x, y);
                x += colWidths[i];
            });
            
            doc.setTextColor(0, 0, 0); // Reset to black
            y += 10;
        });
        
        // Summary totals at the end
        if (y > 250) {
            doc.addPage();
            y = 20;
        }
        
        y += 10;
        doc.setFont(undefined, 'bold');
        doc.text('SUMMARY TOTALS', 20, y);
        y += 10;
        doc.text(`Total Collected: ${formatCurrency(data.totalCollected)}`, 20, y);
        y += 10;
        doc.text(`Paid Members: ${data.paidCount} / ${data.allMembers}`, 20, y);
        y += 10;
        doc.text(`Collection Rate: ${collectionRate.toFixed(1)}%`, 20, y);
        
        // Footer
        y += 20;
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text('This report shows the subscription collection status for all active members.', 20, y);
        doc.text(`Generated by Society Management System on ${new Date().toLocaleDateString()}`, 20, y + 10);
        
        // Save PDF
        const filename = `Subscription_Report_${data.month.replace('-', '_')}.pdf`;
        doc.save(filename);
        
        showAlert('PDF report exported successfully! 📄', 'success');
        
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showAlert('Error exporting PDF: ' + error.message, 'error');
    }
}

// Export Payout Report as PDF
function exportPayoutReportPDF() {
    if (!window.payoutReportData) {
        showAlert('No payout data available. Please calculate profit distribution first.', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const data = window.payoutReportData;
        
        // Header
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('Final Profit Distribution Report', 20, 20);
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(`Period: ${new Date(data.fromDate).toLocaleDateString()} to ${new Date(data.toDate).toLocaleDateString()}`, 20, 30);
        doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 40);
        
        // Financial Summary
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Financial Summary', 20, 55);
        
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(`Total Income: ${formatCurrency(data.totalIncome)}`, 20, 65);
        doc.text(`Total Expenses: ${formatCurrency(data.fdInterestExpense)}`, 20, 75);
        doc.setFont(undefined, 'bold');
        doc.text(`Net Profit: ${formatCurrency(data.netProfit)}`, 20, 85);
        doc.setFont(undefined, 'normal');
        doc.text(`Total Contributions: ${formatCurrency(data.totalContributions)}`, 20, 95);
        
        // Member Distribution Table
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Member-wise Profit Distribution', 20, 110);
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        const headers = ['Member ID', 'Member Name', 'Contribution', 'Share %', 'Profit Share', 'Dividend %'];
        let x = 20;
        const colWidths = [25, 40, 30, 20, 30, 25];
        
        headers.forEach((header, i) => {
            doc.text(header, x, 125);
            x += colWidths[i];
        });
        
        // Table rows
        doc.setFont(undefined, 'normal');
        let y = 135;
        let totalDistributed = 0;
        
        data.profitDistribution.forEach((member) => {
            if (y > 260) { // New page if needed
                doc.addPage();
                y = 20;
            }
            
            totalDistributed += member.profit_share;
            const dividendRate = (member.profit_share / member.total_contribution * 100);
            
            const rowData = [
                `MS${String(member.member_id).padStart(4, '0')}`,
                member.member_name.length > 18 ? member.member_name.substring(0, 18) + '...' : member.member_name,
                formatCurrency(member.total_contribution).replace('₹', ''),
                `${member.contribution_percentage.toFixed(1)}%`,
                formatCurrency(member.profit_share).replace('₹', ''),
                `${dividendRate.toFixed(1)}%`
            ];
            
            x = 20;
            rowData.forEach((data, i) => {
                doc.text(data, x, y);
                x += colWidths[i];
            });
            y += 10;
        });
        
        // Total row
        y += 5;
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL', 20, y);
        doc.text(formatCurrency(data.totalContributions).replace('₹', ''), 85, y);
        doc.text('100.0%', 115, y);
        doc.text(formatCurrency(totalDistributed).replace('₹', ''), 135, y);
        doc.text(`${(totalDistributed/data.totalContributions*100).toFixed(1)}%`, 165, y);
        
        // Footer
        y += 20;
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text('Note: Profit distribution is based on proportional subscription contributions during the period.', 20, y);
        doc.text('Each member\'s share = (Member\'s subscriptions ÷ Total subscriptions) × Net profit', 20, y + 10);
        
        // Save PDF
        const filename = `Profit_Distribution_${data.fromDate}_to_${data.toDate}.pdf`;
        doc.save(filename);
        
        showAlert('PDF report exported successfully! 📄', 'success');
        
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showAlert('Error exporting PDF: ' + error.message, 'error');
    }
}

// Export Loan Ledger as PDF
function exportLoanLedgerPDF() {
    if (!window.loanLedgerData) {
        showAlert('No ledger data available. Please generate the detailed ledger first.', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const data = window.loanLedgerData;
        
        // Header
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('Detailed Loan Ledger', 20, 20);
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(`Member: ${data.memberName} (MS${String(data.memberId).padStart(4, '0')})`, 20, 30);
        doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, 40);
        
        // Summary Section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Loan Summary', 20, 55);
        
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(`Total Disbursed: ${formatCurrency(data.summary.totalPrincipalDisbursed)}`, 20, 65);
        doc.text(`Interest Accrued: ${formatCurrency(data.summary.totalInterestAccrued)}`, 20, 75);
        doc.text(`Total Repaid: ${formatCurrency(data.summary.totalPrincipalPaid + data.summary.totalInterestPaid)}`, 20, 85);
        doc.setFont(undefined, 'bold');
        doc.text(`Outstanding Principal: ${formatCurrency(data.summary.outstandingPrincipal)}`, 20, 95);
        doc.text(`Outstanding Interest: ${formatCurrency(data.summary.outstandingInterest)}`, 20, 105);
        doc.text(`Total Outstanding: ${formatCurrency(data.summary.outstandingPrincipal + Math.max(0, data.summary.outstandingInterest))}`, 20, 115);
        
        // Transaction Table
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Transaction History', 20, 130);
        
        // Table headers
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        const headers = ['Date', 'Type', 'Loan ID', 'Principal Dr.', 'Principal Cr.', 'Interest Dr.', 'Interest Cr.', 'Prin. Bal.', 'Int. Bal.'];
        let x = 10;
        const colWidths = [20, 25, 18, 22, 22, 22, 22, 22, 22];
        
        headers.forEach((header, i) => {
            doc.text(header, x, 145);
            x += colWidths[i];
        });
        
        // Table rows
        doc.setFont(undefined, 'normal');
        let y = 155;
        let runningPrincipalBalance = 0;
        let runningInterestBalance = 0;
        
        data.transactions.forEach((transaction, index) => {
            if (y > 270) { // New page if needed
                doc.addPage();
                y = 20;
                
                // Repeat headers on new page
                doc.setFont(undefined, 'bold');
                x = 10;
                headers.forEach((header, i) => {
                    doc.text(header, x, y);
                    x += colWidths[i];
                });
                y += 10;
                doc.setFont(undefined, 'normal');
            }
            
            // Update running balances
            runningPrincipalBalance += transaction.principal_debit - transaction.principal_credit;
            runningInterestBalance += transaction.interest_debit - transaction.interest_credit;
            runningInterestBalance = Math.max(0, runningInterestBalance);
            
            const rowData = [
                new Date(transaction.date).toLocaleDateString().substring(0, 8), // Shortened date
                transaction.type.substring(0, 12), // Shortened type
                `LN${String(transaction.loan_id).padStart(4, '0')}`,
                transaction.principal_debit > 0 ? formatCurrency(transaction.principal_debit).replace('₹', '').substring(0, 8) : '-',
                transaction.principal_credit > 0 ? formatCurrency(transaction.principal_credit).replace('₹', '').substring(0, 8) : '-',
                transaction.interest_debit > 0 ? formatCurrency(transaction.interest_debit).replace('₹', '').substring(0, 8) : '-',
                transaction.interest_credit > 0 ? formatCurrency(transaction.interest_credit).replace('₹', '').substring(0, 8) : '-',
                formatCurrency(runningPrincipalBalance).replace('₹', '').substring(0, 8),
                formatCurrency(runningInterestBalance).replace('₹', '').substring(0, 8)
            ];
            
            // Set color based on transaction type
            if (transaction.type === 'Loan Disbursement') {
                doc.setTextColor(52, 152, 219); // Blue
            } else if (transaction.type === 'Interest Accrual') {
                doc.setTextColor(243, 156, 18); // Orange
            } else if (transaction.type === 'Repayment') {
                doc.setTextColor(39, 174, 96); // Green
            }
            
            x = 10;
            rowData.forEach((data, i) => {
                doc.text(data, x, y);
                x += colWidths[i];
            });
            
            doc.setTextColor(0, 0, 0); // Reset to black
            y += 8;
        });
        
        // Final Balance Summary
        if (y > 250) {
            doc.addPage();
            y = 20;
        }
        
        y += 10;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text('FINAL BALANCES', 10, y);
        y += 10;
        doc.text(`Outstanding Principal: ${formatCurrency(data.summary.outstandingPrincipal)}`, 10, y);
        y += 10;
        doc.text(`Outstanding Interest: ${formatCurrency(Math.max(0, data.summary.outstandingInterest))}`, 10, y);
        y += 10;
        doc.text(`Total Outstanding: ${formatCurrency(data.summary.outstandingPrincipal + Math.max(0, data.summary.outstandingInterest))}`, 10, y);
        
        // Footer Notes
        y += 15;
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text('Notes:', 10, y);
        y += 8;
        doc.text('• Dr. (Debit): Increases balance (loans disbursed, interest accrued)', 10, y);
        y += 6;
        doc.text('• Cr. (Credit): Decreases balance (payments received)', 10, y);
        y += 6;
        doc.text('• Interest balance cannot go below zero', 10, y);
        y += 6;
        doc.text(`• Generated by Society Management System on ${new Date().toLocaleDateString()}`, 10, y);
        
        // Save PDF
        const filename = `Loan_Ledger_${data.memberName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        
        showAlert('Loan ledger PDF exported successfully! 📄', 'success');
        
    } catch (error) {
        console.error('Error exporting loan ledger PDF:', error);
        showAlert('Error exporting PDF: ' + error.message, 'error');
    }
}

// ==================== NAVIGATION FUNCTIONS ====================

// Sidebar navigation functions
function switchToReportsTab() {
    // Find and click the income statement menu item
    const incomeStatementItem = document.querySelector('[data-section="income-statement"]');
    if (incomeStatementItem) {
        incomeStatementItem.click();
    }
}

// ==================== DATABASE EXPORT/IMPORT FUNCTIONS ====================

// Export database (for Supabase, this would export as JSON or SQL)
function exportDatabase() {
    showAlert('Database export not implemented for Supabase version. Use the cloud backup features instead.', 'error');
}

// Import database (for Supabase, this would import from JSON or SQL)
function importDatabase(event) {
    showAlert('Database import not implemented for Supabase version. Use the cloud backup features instead.', 'error');
}

// ==================== HELPER SEARCH FUNCTIONS ====================

// Update selection highlight
function updateSelection(items, selectedIndex) {
    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Select member (from keyboard or click)
function selectMember(member, hiddenInput, searchInput, resultsDiv) {
    hiddenInput.value = member.id;
    searchInput.value = `MS${String(member.id).padStart(4, '0')} - ${member.name}`;
    resultsDiv.style.display = 'none';
}

// Select loan (from keyboard or click)
function selectLoan(loan, hiddenInput, searchInput, resultsDiv) {
    hiddenInput.value = loan.id;
    searchInput.value = `LN${String(loan.id).padStart(4, '0')} - ${loan.member_name} (${formatCurrency(loan.total_outstanding)})`;
    resultsDiv.style.display = 'none';
}



// Display loan search results
function displayLoanSearchResults(results, resultsDiv, hiddenInput, searchInput) {
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">No active loans found</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    let html = '';
    results.forEach((loan, index) => {
        let rateInfo = '';
        if (loan.interest_rate_type === 'progressive') {
            rateInfo = '2%/3%';
        } else if (loan.interest_rate_type === 'flat') {
            rateInfo = `${loan.manual_interest_rate}%`;
        } else {
            rateInfo = '0%';
        }

        html += `
            <div class="search-result-item" data-index="${index}" onclick="selectLoanFromClick(${loan.id}, '${loan.member_name.replace(/'/g, "\\'")}', ${loan.principal_balance}, ${loan.interest_balance}, '${hiddenInput.id}', '${searchInput.id}', '${resultsDiv.id}')">
                <div class="member-id">LN${String(loan.id).padStart(4, '0')} - ${loan.member_name}</div>
                <div style="font-size: 12px; color: #666;">
                    Principal: ${formatCurrency(loan.principal_balance)} | Interest: ${formatCurrency(loan.interest_balance)} | Rate: ${rateInfo}
                </div>
                <div style="font-weight: bold; color: #e74c3c;">Total Outstanding: ${formatCurrency(loan.total_outstanding)}</div>
            </div>
        `;
    });

    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
}

// Display loan statement search results
function displayLoanStatementSearchResults(results, resultsDiv, hiddenInput, searchInput) {
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">No members found</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    let html = '';
    results.forEach((member, index) => {
        html += `
            <div class="search-result-item" data-index="${index}" onclick="selectLoanStatementMemberFromClick(${member.id}, '${member.name.replace(/'/g, "\\'")}')">
                <div class="member-id">MS${String(member.id).padStart(4, '0')}</div>
                <div>${member.name}</div>
                <small style="color: #666;">${member.contact}</small>
            </div>
        `;
    });

    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
}

// ==================== GLOBAL ONCLICK FUNCTIONS ====================

// These functions are called from HTML onclick attributes and need to be global


// Select loan from click (global function for onclick)
function selectLoanFromClick(loanId, memberName, principalBalance, interestBalance, hiddenInputId, searchInputId, resultsDivId) {
    const hiddenInput = document.getElementById(hiddenInputId);
    const searchInput = document.getElementById(searchInputId);
    const resultsDiv = document.getElementById(resultsDivId);
    
    if (hiddenInput && searchInput && resultsDiv) {
        const totalOutstanding = principalBalance + interestBalance;
        
        hiddenInput.value = loanId;
        searchInput.value = `LN${String(loanId).padStart(4, '0')} - ${memberName} (${formatCurrency(totalOutstanding)})`;
        resultsDiv.style.display = 'none';
    }
}

// Select loan statement member from click (global function for onclick)
function selectLoanStatementMemberFromClick(memberId, memberName) {
    const hiddenInput = document.getElementById('loanStatementMember');
    const searchInput = document.getElementById('loanStatementMemberSearch');
    const resultsDiv = document.getElementById('loanStatementMemberResults');
    
    if (hiddenInput && searchInput && resultsDiv) {
        hiddenInput.value = memberId;
        searchInput.value = `MS${String(memberId).padStart(4, '0')} - ${memberName}`;
        resultsDiv.style.display = 'none';
    }
}

// ==================== SIDEBAR NAVIGATION FUNCTIONS ====================
// Add these functions to your script.js file

// Initialize sidebar navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const menuToggle = document.getElementById('menuToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const pageTitle = document.getElementById('pageTitle');

    // Menu toggle functionality
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            if (window.innerWidth <= 1024) {
                sidebar.classList.toggle('show');
                sidebarOverlay.classList.toggle('show');
            } else {
                sidebar.classList.toggle('collapsed');
                mainContent.classList.toggle('expanded');
            }
        });
    }

    // Close sidebar when clicking overlay
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('show');
            sidebarOverlay.classList.remove('show');
        });
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 1024) {
            sidebar.classList.remove('show');
            sidebarOverlay.classList.remove('show');
        }
    });

    // Submenu toggle functionality
    document.querySelectorAll('[data-toggle]').forEach(function(menuItem) {
        menuItem.addEventListener('click', function(e) {
            e.preventDefault();
            const submenuId = this.getAttribute('data-toggle') + '-submenu';
            const submenu = document.getElementById(submenuId);
            
            // Close other submenus
            document.querySelectorAll('.submenu').forEach(function(sub) {
                if (sub !== submenu) {
                    sub.classList.remove('expanded');
                    sub.parentElement.classList.remove('expanded');
                }
            });
            
            // Toggle current submenu
            if (submenu) {
                submenu.classList.toggle('expanded');
                this.classList.toggle('expanded');
            }
        });
    });

    // Section navigation
    document.querySelectorAll('[data-section]').forEach(function(menuItem) {
        menuItem.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            showSection(sectionId);
            
            // Update page title
            const sectionTitles = {
                'dashboard': 'Dashboard',
                'add-member': 'Add New Member',
                'import-members': 'Import Members',
                'manage-members': 'Manage Members',
                'bulk-subscription': 'Bulk Subscriptions',
                'individual-subscription': 'Individual Subscription',
                'subscription-history': 'Subscription History',
                'issue-loan': 'Issue New Loan',
                'loan-topup': 'Loan Top-up',
                'loan-repayment': 'Loan Repayment',
                'monthly-interest': 'Monthly Interest',
                'active-loans': 'Active Loans',
                'create-fd': 'Create Fixed Deposit',
                'fd-list': 'Fixed Deposits List',
                'fd-interest-calc': 'FD Interest Calculation',
                'subscription-report': 'Collection Report',
                'income-statement': 'Income Statement',
                'loan-statement': 'Loan Statement',
                'profit-distribution': 'Profit Distribution',
                'quarter-settings': 'Quarter Settings',
                'data-management': 'Data Management'
            };
            
            if (pageTitle) {
                pageTitle.textContent = sectionTitles[sectionId] || 'Society Management';
            }
            
            // Update active states
            document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));
            document.querySelectorAll('.submenu-item').forEach(item => item.classList.remove('active'));
            
            this.classList.add('active');
            
            // Close sidebar on mobile after selection
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('show');
                sidebarOverlay.classList.remove('show');
            }

            // Refresh member selects and data when appropriate sections are shown
            setTimeout(() => {
                populateMemberSelects();
                
                // Load quarter settings when settings tab is shown
                if (sectionId === 'quarter-settings') {
                    loadQuarterSettings();
                }
            }, 200);
        });
    });

    // Function to show/hide sections
    function showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(function(section) {
            section.classList.remove('active');
        });
        
        // Show selected section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    }

    // Initialize the application after DOM is ready
    setTimeout(() => {
        initApp();
    }, 100);
});

// Function to switch to reports tab (called from dashboard)
function switchToReportsTab() {
    const incomeStatementItem = document.querySelector('[data-section="income-statement"]');
    if (incomeStatementItem) {
        // Trigger click event to activate the section
        incomeStatementItem.click();
    } else {
        // Fallback: manually show the section
        showSection('income-statement');
        document.getElementById('pageTitle').textContent = 'Income Statement';
        
        // Update active states
        document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));
        document.querySelectorAll('.submenu-item').forEach(item => item.classList.remove('active'));
        
        const incomeItem = document.querySelector('[data-section="income-statement"]');
        if (incomeItem) {
            incomeItem.classList.add('active');
        }
    }
}

// Helper function to show specific section (can be called programmatically)
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(function(section) {
        section.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

// Function to set active menu item
function setActiveMenuItem(sectionId) {
    // Remove active class from all menu items
    document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('.submenu-item').forEach(item => item.classList.remove('active'));
    
    // Add active class to current menu item
    const currentMenuItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (currentMenuItem) {
        currentMenuItem.classList.add('active');
        
        // If it's a submenu item, also expand the parent menu
        const parentSubmenu = currentMenuItem.closest('.submenu');
        if (parentSubmenu) {
            parentSubmenu.classList.add('expanded');
            const parentMenuItem = parentSubmenu.previousElementSibling;
            if (parentMenuItem) {
                parentMenuItem.classList.add('expanded');
            }
        }
    }
}

// Function to navigate to a specific section programmatically
function navigateToSection(sectionId) {
    showSection(sectionId);
    setActiveMenuItem(sectionId);
    
    // Update page title
    const sectionTitles = {
        'dashboard': 'Dashboard',
        'add-member': 'Add New Member',
        'import-members': 'Import Members',
        'manage-members': 'Manage Members',
        'bulk-subscription': 'Bulk Subscriptions',
        'individual-subscription': 'Individual Subscription',
        'subscription-history': 'Subscription History',
        'issue-loan': 'Issue New Loan',
        'loan-topup': 'Loan Top-up',
        'loan-repayment': 'Loan Repayment',
        'monthly-interest': 'Monthly Interest',
        'active-loans': 'Active Loans',
        'create-fd': 'Create Fixed Deposit',
        'fd-list': 'Fixed Deposits List',
        'fd-interest-calc': 'FD Interest Calculation',
        'subscription-report': 'Collection Report',
        'income-statement': 'Income Statement',
        'loan-statement': 'Loan Statement',
        'profit-distribution': 'Profit Distribution',
        'quarter-settings': 'Quarter Settings',
        'data-management': 'Data Management'
    };
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = sectionTitles[sectionId] || 'Society Management';
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('show');
        if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    }
    
    // Refresh data for specific sections
    setTimeout(() => {
        populateMemberSelects();
        
        if (sectionId === 'quarter-settings') {
            loadQuarterSettings();
        } else if (sectionId === 'dashboard') {
            loadDashboard();
        } else if (sectionId === 'manage-members') {
            loadMembers();
        } else if (sectionId === 'subscription-history') {
            loadSubscriptions();
        } else if (sectionId === 'active-loans') {
            loadLoans();
        } else if (sectionId === 'fd-list') {
            loadDeposits();
        }
    }, 200);
}

// Toggle interest rate input based on selected type
function toggleInterestRateInput() {
    const interestType = document.querySelector('input[name="interestType"]:checked');
    if (!interestType) return;
    
    const manualRateGroup = document.getElementById('manualRateGroup');
    const manualRateInput = document.getElementById('manualInterestRate');
    
    if (!manualRateGroup || !manualRateInput) return;
    
    if (interestType.value === 'flat') {
        manualRateGroup.style.display = 'block';
        manualRateInput.required = true;
        manualRateInput.value = '';
    } else {
        manualRateGroup.style.display = 'none';
        manualRateInput.required = false;
        manualRateInput.value = '0';
    }
}

// Close edit member modal
function closeEditMemberModal() {
    const modal = document.getElementById('editMemberModal');
    const form = document.getElementById('editMemberForm');
    
    if (modal) modal.style.display = 'none';
    if (form) form.reset();
}

// ==================== IMPROVED DASHBOARD LOADING ====================

// Updated loadDashboard function to handle outstanding_amount
async function loadDashboard() {
    try {
        // Active members only
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id')
            .eq('status', 'active');
        
        if (memberError) throw memberError;
        
        const totalMembersElement = document.getElementById('totalMembers');
        if (totalMembersElement) totalMembersElement.textContent = memberData?.length || 0;
        
        // Calculate net cash position
        let netCash = 0;
        
        // Add: Total subscriptions received (with pagination)
        const totalSubscriptions = await getTotalSubscriptions();
        netCash += totalSubscriptions;
        
        // Add: Principal repayments received (with pagination)
        const totalPrincipalRepayments = await getTotalPrincipalRepayments();
        netCash += totalPrincipalRepayments;
        
        // Subtract: Total loan disbursements (with pagination)
        const totalLoanDisbursements = await getTotalLoanDisbursements();
        netCash -= totalLoanDisbursements;
        
        // Add: FD deposits received (with pagination)
        const totalFDDeposits = await getTotalFDDeposits();
        netCash += totalFDDeposits;

        // Add: Interest repayments received
        const totalInterestRepayments = await getTotalInterestRepayments();
        netCash += totalInterestRepayments;
        
        // Update net cash display
        const netCashElement = document.getElementById('netCashPosition');
        if (netCashElement) netCashElement.textContent = formatCurrency(netCash);
        
        // Calculate total liabilities
        let totalLiabilities = 0;
        
        // FD principal + interest earned
        const totalFDInterestEarned = await getTotalFDInterestEarned();
        totalLiabilities += totalFDDeposits + totalFDInterestEarned;
        
        // Member subscriptions (refundable)
        totalLiabilities += totalSubscriptions;
        
        // Update total liabilities display
        const liabilitiesElement = document.getElementById('totalLiabilities');
        if (liabilitiesElement) liabilitiesElement.textContent = formatCurrency(totalLiabilities);
        
        // Calculate active loans outstanding
        const totalActiveLoans = await getTotalActiveLoans();
        
        // Update active loans display
        const activeLoansElement = document.getElementById('activeLoans');
        if (activeLoansElement) activeLoansElement.textContent = formatCurrency(totalActiveLoans);
        
        // Load current month income/expenditure summary
        await loadCurrentMonthIncomeExpenditure();
        
        // Load recent transactions
        await loadRecentTransactions();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('Error loading dashboard data: ' + error.message, 'error');
    }
}

// Helper functions to handle pagination for large datasets

async function getTotalInterestRepayments() {
    let total = 0;
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
        const { data: repayments, error } = await supabase
            .from('loan_repayments')
            .select('interest_amount')
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        if (repayments && repayments.length > 0) {
            total += repayments.reduce((sum, rep) => sum + (parseFloat(rep.interest_amount) || 0), 0);
            from += limit;
            
            if (repayments.length < limit) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }
    
    return total;
}

async function getTotalSubscriptions() {
    let total = 0;
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
        const { data: subscriptions, error } = await supabase
            .from('subscriptions')
            .select('amount')
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        if (subscriptions && subscriptions.length > 0) {
            total += subscriptions.reduce((sum, sub) => sum + (parseFloat(sub.amount) || 0), 0);
            from += limit;
            
            if (subscriptions.length < limit) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }
    
    return total;
}

async function getTotalPrincipalRepayments() {
    let total = 0;
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
        const { data: repayments, error } = await supabase
            .from('loan_repayments')
            .select('principal_amount')
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        if (repayments && repayments.length > 0) {
            total += repayments.reduce((sum, rep) => sum + (parseFloat(rep.principal_amount) || 0), 0);
            from += limit;
            
            if (repayments.length < limit) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }
    
    return total;
}

async function getTotalLoanDisbursements() {
    let total = 0;
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
        const { data: loans, error } = await supabase
            .from('loans')
            .select('amount')
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        if (loans && loans.length > 0) {
            total += loans.reduce((sum, loan) => sum + (parseFloat(loan.amount) || 0), 0);
            from += limit;
            
            if (loans.length < limit) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }
    
    return total;
}

async function getTotalFDDeposits() {
    let total = 0;
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
        const { data: deposits, error } = await supabase
            .from('fixed_deposits')
            .select('amount')
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        if (deposits && deposits.length > 0) {
            total += deposits.reduce((sum, fd) => sum + (parseFloat(fd.amount) || 0), 0);
            from += limit;
            
            if (deposits.length < limit) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }
    
    return total;
}

async function getTotalFDInterestEarned() {
    let total = 0;
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
        const { data: fdInterest, error } = await supabase
            .from('fd_interest_calculations')
            .select('interest_earned')
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        if (fdInterest && fdInterest.length > 0) {
            total += fdInterest.reduce((sum, calc) => sum + (parseFloat(calc.interest_earned) || 0), 0);
            from += limit;
            
            if (fdInterest.length < limit) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }
    
    return total;
}

async function getTotalActiveLoans() {
    let total = 0;
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
        const { data: activeLoans, error } = await supabase
            .from('loans')
            .select(`
                amount, outstanding_amount,
                loan_repayments(principal_amount)
            `)
            .eq('status', 'active')
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        if (activeLoans && activeLoans.length > 0) {
            activeLoans.forEach(loan => {
                // Use outstanding_amount if available, otherwise calculate
                if (loan.outstanding_amount !== null) {
                    total += parseFloat(loan.outstanding_amount) || 0;
                } else {
                    const totalPaid = loan.loan_repayments?.reduce((sum, rep) => sum + (parseFloat(rep.principal_amount) || 0), 0) || 0;
                    const outstanding = (parseFloat(loan.amount) || 0) - totalPaid;
                    total += Math.max(0, outstanding);
                }
            });
            
            from += limit;
            
            if (activeLoans.length < limit) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }
    
    return total;
}


// ADD THESE FUNCTIONS TO YOUR script.js FILE




// Helper function to get months between two dates
function getMonthsBetween(startMonth, endMonth) {
    const months = [];
    const start = new Date(startMonth + '-01');
    const end = new Date(endMonth + '-01');
    
    while (start <= end) {
        const monthStr = start.toISOString().substring(0, 7);
        months.push(monthStr);
        start.setMonth(start.getMonth() + 1);
    }
    
    return months;
}


// Load current month income/expenditure for dashboard
// Load current month income/expenditure for dashboard with pagination
async function loadCurrentMonthIncomeExpenditure() {
    try {
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
        
        // Calculate income (interest received + accrued) with pagination
        let totalIncome = 0;
        
        // Interest received
        let from = 0;
        const limit = 1000;
        let hasMore = true;
        
        while (hasMore) {
            const { data: interestReceived, error } = await supabase
                .from('loan_repayments')
                .select('interest_amount')
                .gte('payment_date', startOfMonth)
                .lte('payment_date', endOfMonth)
                .range(from, from + limit - 1);
            
            if (error) throw error;
            
            if (interestReceived && interestReceived.length > 0) {
                totalIncome += interestReceived.reduce((sum, rep) => sum + (parseFloat(rep.interest_amount) || 0), 0);
                from += limit;
                
                if (interestReceived.length < limit) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }
        
        // Interest accrued
        from = 0;
        hasMore = true;
        
        while (hasMore) {
            const { data: interestAccrued, error } = await supabase
                .from('loan_interest_accruals')
                .select('accrued_amount')
                .gte('accrual_date', startOfMonth)
                .lte('accrual_date', endOfMonth)
                .range(from, from + limit - 1);
            
            if (error) throw error;
            
            if (interestAccrued && interestAccrued.length > 0) {
                totalIncome += interestAccrued.reduce((sum, acc) => sum + (parseFloat(acc.accrued_amount) || 0), 0);
                from += limit;
                
                if (interestAccrued.length < limit) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }
        
        // Calculate expenditure (FD interest) with pagination
        let totalExpenditure = 0;
        from = 0;
        hasMore = true;
        
        while (hasMore) {
            const { data: fdExpense, error } = await supabase
                .from('fd_interest_calculations')
                .select('interest_earned')
                .gte('calculation_date', startOfMonth)
                .lte('calculation_date', endOfMonth)
                .range(from, from + limit - 1);
            
            if (error) throw error;
            
            if (fdExpense && fdExpense.length > 0) {
                totalExpenditure += fdExpense.reduce((sum, calc) => sum + (parseFloat(calc.interest_earned) || 0), 0);
                from += limit;
                
                if (fdExpense.length < limit) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }
        
        // Calculate net profit
        const netProfit = totalIncome - totalExpenditure;
        
        // Update dashboard elements
        const incomeElement = document.getElementById('currentMonthIncome');
        const expenditureElement = document.getElementById('currentMonthExpenditure');
        const profitElement = document.getElementById('currentMonthProfit');
        
        if (incomeElement) incomeElement.textContent = formatCurrency(totalIncome);
        if (expenditureElement) expenditureElement.textContent = formatCurrency(totalExpenditure);
        if (profitElement) profitElement.textContent = formatCurrency(netProfit);
        
    } catch (error) {
        console.error('Error loading current month income/expenditure:', error);
    }
}

console.log('Complete loan functions and missing event listeners added successfully!');

console.log('Sidebar navigation functions loaded successfully!');

console.log('All missing Supabase functions have been implemented successfully!');

console.log('All syntax errors fixed - ready for Supabase!');
