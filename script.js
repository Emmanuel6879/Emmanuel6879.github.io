// scripts.js
// --- Firebase Imports (Requires type="module" on the script tag in HTML) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, // Use setDoc for user creation
    query, orderBy, where, getDoc, updateDoc, onSnapshot, serverTimestamp, limit, offset, enablePersistence // Added enablePersistence
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-analytics.js";
// Storage is not used in this version, but kept import if needed later
// import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-storage.js"; 

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyAy8F1-_npmdlqkZnZMh3TgjnLZqPBcg0k",
    
    authDomain: "dailyactivity-ddd22.firebaseapp.com",
    projectId: "dailyactivity-ddd22",
    storageBucket: "dailyactivity-ddd22.firebasestorage.app",
    messagingSenderId: "190226737067",
    appId: "1:190226737067:web:f24e3765f02485f93094ee",
    measurementId: "G-4YW1XJ8XYQ"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);
// const storage = getStorage(app); // Initialize if needed

// --- Collections ---
const activitiesCollection = collection(db, "activities");
const usersCollection = collection(db, "users");
const metadataCollection = collection(db, "metadata"); // Assuming you have this for sync status

// --- DOM Elements ---
const loadingOverlay = document.getElementById('loading-overlay');
const toastContainer = document.getElementById('toast-container');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

// Auth Elements
const authTabs = authContainer.querySelectorAll('.tabs .tab');
const authTabContents = authContainer.querySelectorAll('.tab-content');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const forgotPassword = document.getElementById('forgot-password');
const resendVerification = document.getElementById('resend-verification');

// App Header Elements
const userEmailDisplay = document.getElementById('user-email'); // Changed variable name for clarity
const syncStatus = document.getElementById('sync-status');
const logoutBtn = document.getElementById('logout-btn');

// App Tab Elements
const appTabs = document.querySelectorAll('#app-container .tabs .tab');
const appTabContents = document.querySelectorAll('#app-container .tab-content');
const usersTabButton = document.getElementById('users-tab'); // The button itself

// Entry Form Elements
const activityForm = document.getElementById('activity-form');
const dateInput = document.getElementById('date'); // Specific input reference

// Records Elements
const recordsBody = document.getElementById('records-body');
const filterMonth = document.getElementById('filter-month');
const filterType = document.getElementById('filter-type');
const exportBtn = document.getElementById('export-btn');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');

// Reports Elements
const reportMonth = document.getElementById('report-month');
const totalActivitiesEl = document.getElementById('total-activities');
const uniqueFacilitiesEl = document.getElementById('unique-facilities');
const totalOfficersEl = document.getElementById('total-officers');
const commonActivityEl = document.getElementById('common-activity');
const activityChartCanvas = document.getElementById('activity-chart');
const timeChartCanvas = document.getElementById('time-chart');
const facilityChartCanvas = document.getElementById('facility-chart');
const officerChartCanvas = document.getElementById('officer-chart');

// Users Elements
const usersBody = document.getElementById('users-body');


// --- App State ---
let currentUser = null;
let activities = []; // Holds the activities for the current page/filters
let allUserActivities = []; // Optionally holds all activities for reporting if needed, manage memory
let currentPage = 1;
const itemsPerPage = 15; // Adjust as needed
let totalActivityCount = 0; // To calculate total pages
let activityChart = null;
let timeChart = null;
let facilityChart = null;
let officerChart = null;
let unsubscribeActivities = null; // To detach listener on logout


// --- Initialize App ---
function initApp() {
    console.log("Initializing App...");
    setupEventListeners();
    setupAuthStateObserver();
    // setupFirestoreSyncStatus(); // Uncomment if you have the 'metadata/sync' doc
    enableFirestorePersistence();
    // Set default date and report month
    dateInput.valueAsDate = new Date();
    reportMonth.value = new Date().getMonth().toString();
    // Hide app container initially
    appContainer.style.display = 'none';
    authContainer.style.display = 'block'; // Show auth by default
    hideLoading(); // Ensure loading is hidden initially
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Auth Tab Switching
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            authTabs.forEach(t => t.classList.remove('active'));
            authTabContents.forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        await handleLogin(email, password);
    });

    // Registration
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = registerForm['register-email'].value;
        const password = registerForm['register-password'].value;
        const confirmPassword = registerForm['confirm-password'].value;
        await handleRegistration(email, password, confirmPassword);
    });

    // Forgot password
    forgotPassword.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = prompt("Enter your email address to receive a password reset link:");
        if (email) {
            try {
                showLoading();
                await sendPasswordResetEmail(auth, email);
                showToast("Password reset email sent! Check your inbox (and spam folder).");
            } catch (error) {
                showToast(`Error: ${error.message}`, "error");
            } finally {
                hideLoading();
            }
        }
    });

    // Resend verification
    resendVerification.addEventListener('click', async (e) => {
        e.preventDefault();
        if (auth.currentUser && !auth.currentUser.emailVerified) {
            try {
                showLoading();
                await sendEmailVerification(auth.currentUser);
                showToast("Verification email resent! Check your inbox (and spam folder).");
            } catch (error) {
                showToast(`Error: ${error.message}`, "error");
            } finally {
                hideLoading();
            }
        } else if (auth.currentUser && auth.currentUser.emailVerified) {
             showToast("Your email is already verified.", "info");
        } else {
            showToast("You must be logged in (or recently registered) to resend verification.", "warning");
        }
    });

    // Activity Form Submission
    activityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleActivitySubmission();
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        await handleLogout();
    });

    // Filter change events
    filterMonth.addEventListener('change', renderActivities); // Re-render based on current `activities` array
    filterType.addEventListener('change', renderActivities);  // Re-render based on current `activities` array

    // Export to CSV
    exportBtn.addEventListener('click', exportToCSV);

    // Report month change event
    reportMonth.addEventListener('change', generateReports);

    // Pagination controls
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadActivities(); // Fetch previous page data
        }
    });

    nextPageBtn.addEventListener('click', () => {
        // Calculate total pages based on total count
        const totalPages = Math.ceil(totalActivityCount / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            loadActivities(); // Fetch next page data
        }
    });

    // Main App Tab switching
    appTabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const tabId = tab.getAttribute('data-tab');

            // Admin check for Users tab
            if (tabId === 'users') {
                const isAdminUser = await isAdmin();
                if (!isAdminUser) {
                    showToast("Access Denied: You don't have permission to view User Management.", "error");
                    return; // Prevent switching to the tab
                }
                await loadUsers(); // Load users when switching to the tab
            }

            // Update tab and content visibility
            appTabs.forEach(t => t.classList.remove('active'));
            appTabContents.forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // Refresh data if needed when switching tabs
            if (tabId === 'records') {
                // Data is loaded via loadActivities and pagination, rendering happens in renderActivities
                renderActivities();
            } else if (tabId === 'reports') {
                // Generate reports with currently loaded (allUserActivities or potentially fetch all needed)
                generateReports();
            }
            // No specific action needed for 'entry' tab on switch
        });
    });
}

// --- Auth State Management ---
function setupAuthStateObserver() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User is signed in:", user.uid);
            currentUser = user; // Set global currentUser
            await handleAuthenticatedUser(user);
        } else {
            console.log("User is signed out.");
            currentUser = null; // Clear global currentUser
            handleUnauthenticatedUser();
        }
    });
}

async function handleAuthenticatedUser(user) {
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    userEmailDisplay.textContent = user.email;

    if (!user.emailVerified) {
        showToast('Please verify your email address. Check your inbox.', 'warning');
        // Optionally disable features until verified
    }

    const isAdminUser = await checkAdminStatus(user); // Check and store admin status if needed elsewhere
    usersTabButton.style.display = isAdminUser ? 'block' : 'none'; // Show/hide User Mgmt tab

    currentPage = 1; // Reset to first page on login
    await loadActivities(); // Load initial data for the user/admin
    // await loadAllActivitiesForReporting(); // Consider loading all data needed for reports here
}

function handleUnauthenticatedUser() {
    authContainer.style.display = 'block';
    appContainer.style.display = 'none';
    resetAppState(); // Clear data and UI state
}

function resetAppState() {
    // Clear local data
    activities = [];
    allUserActivities = [];
    totalActivityCount = 0;
    currentPage = 1;
    
    // Clear UI elements
    recordsBody.innerHTML = '';
    pageInfo.textContent = 'Page 1 of 1';
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    usersBody.innerHTML = ''; // Clear users table if visible

    // Reset charts
    resetCharts();

    // Detach listeners if any were active
    if (unsubscribeActivities) {
        unsubscribeActivities();
        unsubscribeActivities = null;
    }
    console.log("App state reset.");
}


// --- Authentication Handlers ---
async function handleLogin(email, password) {
    try {
        showLoading();
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Auth state change observer will handle the rest (handleAuthenticatedUser)
        showToast('Login successful!', 'success');
        loginForm.reset();
    } catch (error) {
        showToast(`Login Failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function handleRegistration(email, password, confirmPassword) {
    if (password !== confirmPassword) {
        showToast("Passwords do not match.", "error");
        return;
    }
    if (password.length < 6) {
         showToast("Password must be at least 6 characters long.", "error");
        return;
    }

    try {
        showLoading();
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("User created:", userCredential.user.uid);

        // Send verification email
        await sendEmailVerification(userCredential.user);
        console.log("Verification email sent.");

        // Add user to Firestore 'users' collection using UID as document ID
        const userDocRef = doc(usersCollection, userCredential.user.uid); // Create doc ref with UID
        await setDoc(userDocRef, { // Use setDoc to specify the ID
            uid: userCredential.user.uid,
            email: email,
            role: "user", // Default role
            createdAt: serverTimestamp()
        });
        console.log("User document created in Firestore.");

        showToast("Registration successful! Please check your email to verify your account.", "success");
        registerForm.reset();
        // Optionally switch to login tab or logout the user until verified
        // await handleLogout(); // Force login after verification
    } catch (error) {
        showToast(`Registration Failed: ${error.message}`, "error");
        console.error("Registration error details:", error);
    } finally {
        hideLoading();
    }
}

async function handleLogout() {
    try {
        showLoading();
        await signOut(auth);
        // Auth state change observer will handle the rest (handleUnauthenticatedUser)
        showToast('Logged out successfully.', 'success');
    } catch (error) {
        showToast(`Logout Failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// --- Activity Management ---
async function handleActivitySubmission() {
    if (!currentUser) {
        showToast("You must be logged in to submit an activity.", "error");
        return;
    }

    const dateValue = dateInput.value;
    const newActivity = {
        date: new Date(dateValue), // Store as Firestore Timestamp via serverTimestamp or Date object
        facility: document.getElementById('facility').value.trim(),
        address: document.getElementById('address').value.trim(),
        activityType: document.getElementById('activityType').value,
        observation: document.getElementById('observation').value.trim(),
        officers: document.getElementById('officers').value.split(',').map(o => o.trim()).filter(o => o), // Ensure no empty strings
        recommendation: document.getElementById('recommendation').value.trim(),
        timestamp: serverTimestamp(), // Use server timestamp for reliable ordering
        userId: currentUser.uid,
        userEmail: currentUser.email // Store email for easier display if needed
    };

    // Validate data
    const errors = validateActivityData(newActivity);
    if (errors.length > 0) {
        showToast(`Please fix the following errors:\n- ${errors.join("\n- ")}`, "error");
        return;
    }

    try {
        showLoading();
        const docRef = await addDoc(activitiesCollection, newActivity);
        console.log("Activity added with ID:", docRef.id);

        showToast('Activity logged successfully!', 'success');
        activityForm.reset();
        dateInput.valueAsDate = new Date(); // Reset date to today

        // Refresh data - could just add locally if using snapshots, or reload page
        currentPage = 1; // Go back to first page to see the new entry
        await loadActivities();
        // Potentially update allUserActivities if used for reports
        // await loadAllActivitiesForReporting();
        generateReports(); // Update reports immediately

    } catch (error) {
        showToast(`Error saving activity: ${error.message}`, 'error');
        console.error("Error adding activity:", error);
    } finally {
        hideLoading();
    }
}

// Data validation for Activity
function validateActivityData(data) {
    const errors = [];
    // Ensure date is valid (checking against epoch start is a basic check)
    if (!data.date || isNaN(data.date.getTime()) || data.date.getTime() < 0) errors.push("Invalid or missing Date");
    if (!data.facility) errors.push("Facility Name is required");
    if (!data.address) errors.push("Facility Address is required");
    if (!data.activityType) errors.push("Activity Type must be selected");
    if (!data.observation) errors.push("Observation/Action is required");
    if (!data.officers || data.officers.length === 0) errors.push("At least one NAFDAC Officer name is required");
    if (!data.recommendation) errors.push("Recommendation is required");
    return errors;
}

// --- Data Loading ---
async function loadActivities() {
    if (!currentUser) return; // Don't load if not logged in

    try {
        showLoading();

        // Determine base query (admin sees all, user sees own)
        let baseQuery;
        const isAdminUser = await isAdmin();
        if (isAdminUser) {
            baseQuery = query(activitiesCollection, orderBy('timestamp', 'desc'));
        } else {
            baseQuery = query(activitiesCollection, where('userId', '==', currentUser.uid), orderBy('timestamp', 'desc'));
        }

        // Get total count for pagination (run this query separately without limits/offsets)
        const countSnapshot = await getDocs(baseQuery);
        totalActivityCount = countSnapshot.size;

        // Construct the paginated query
        const paginatedQuery = query(baseQuery,
                                     limit(itemsPerPage),
                                     offset((currentPage - 1) * itemsPerPage));

        const snapshot = await getDocs(paginatedQuery);
        activities = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firestore Timestamp to JS Date IF it exists
            date: doc.data().date?.toDate ? doc.data().date.toDate() : null,
            timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : null
        })).filter(act => act.date); // Ensure activities have a valid date after conversion

        console.log(`Loaded ${activities.length} activities for page ${currentPage}`);

        updatePagination();
        renderActivities(); // Render the loaded page
        // Optionally load *all* activities separately if reports need full dataset
        // await loadAllActivitiesForReporting(isAdminUser);
        generateReports(); // Update reports based on currently loaded page/filters or all data

    } catch (error) {
        showToast(`Error loading activities: ${error.message}`, 'error');
        console.error("Error loading activities:", error);
    } finally {
        hideLoading();
    }
}

// Optional: Load all activities for reporting purposes
// Be mindful of performance and cost with large datasets
async function loadAllActivitiesForReporting(isAdminUser) {
    if (!currentUser) return;
     try {
        console.log("Loading all activities for reporting...");
        let reportQuery;
        if (isAdminUser === undefined) isAdminUser = await isAdmin(); // Check if not passed

        if (isAdminUser) {
            reportQuery = query(activitiesCollection, orderBy('timestamp', 'desc'));
        } else {
            reportQuery = query(activitiesCollection, where('userId', '==', currentUser.uid), orderBy('timestamp', 'desc'));
        }
         const reportSnapshot = await getDocs(reportQuery);
        allUserActivities = reportSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate ? doc.data().date.toDate() : null,
            timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : null
        })).filter(act => act.date);
         console.log(`Loaded ${allUserActivities.length} total activities for reports.`);
    } catch (error) {
        console.error("Error loading all activities for reports:", error);
        showToast("Could not load full data for reports.", "warning");
    }
}


// --- UI Updates ---
function updatePagination() {
    const totalPages = Math.ceil(totalActivityCount / itemsPerPage);
    pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`; // Handle 0 activities case
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

function renderActivities() {
    // Get filter values
    const monthFilterValue = filterMonth.value;
    const typeFilterValue = filterType.value;

    // Filter the currently loaded `activities` array
    const filteredActivities = activities.filter(activity => {
        const activityDate = activity.date; // Already a JS Date object
        if (!activityDate) return false; // Skip if date is invalid

        const matchMonth = monthFilterValue === '' || activityDate.getMonth() === parseInt(monthFilterValue);
        const matchType = typeFilterValue === '' || activity.activityType === typeFilterValue;

        return matchMonth && matchType;
    });

    // Clear table body
    recordsBody.innerHTML = '';

    // Populate table
    if (filteredActivities.length === 0) {
        recordsBody.innerHTML = '<tr><td colspan="6">No records found for this page or filter criteria.</td></tr>';
    } else {
        filteredActivities.forEach(activity => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${activity.date.toLocaleDateString()}</td>
                <td>${activity.facility || 'N/A'}</td>
                <td>${activity.activityType || 'N/A'}</td>
                <td>${(activity.observation || '').substring(0, 50)}${(activity.observation || '').length > 50 ? '...' : ''}</td>
                <td>${(activity.officers || []).join(', ')}</td>
                <td class="actions">
                    <button class="btn-small btn-danger" onclick="deleteActivity('${activity.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <!-- Add edit button/logic here if needed -->
                    <!-- <button class="btn-small btn-edit" onclick="editActivity('${activity.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button> -->
                </td>
            `;
            recordsBody.appendChild(row);
        });
    }
}

// --- Chart Handling ---
function generateReports() {
    // Decide which dataset to use for reports:
    // Option 1: Use only the activities currently loaded on the page (`activities` array)
    // Option 2: Use all activities loaded separately (`allUserActivities` array) - potentially more accurate but needs `loadAllActivitiesForReporting`
    const reportData = allUserActivities.length > 0 ? allUserActivities : activities; // Choose dataset

    const selectedMonth = parseInt(reportMonth.value);

    // Filter the chosen dataset for the selected month
    const monthActivities = reportData.filter(activity => {
        if (!activity.date) return false;
        return activity.date.getMonth() === selectedMonth;
    });

    console.log(`Generating reports for month ${selectedMonth} with ${monthActivities.length} activities.`);

    updateSummaryStats(monthActivities);
    renderActivityTypeChart(monthActivities);
    renderTimeChart(monthActivities);
    renderFacilityChart(monthActivities);
    renderOfficerChart(monthActivities);
}

function updateSummaryStats(activities) {
    const total = activities.length;
    totalActivitiesEl.textContent = total;

    if (total === 0) {
        uniqueFacilitiesEl.textContent = '0';
        totalOfficersEl.textContent = '0';
        commonActivityEl.textContent = '-';
        return;
    }

    uniqueFacilitiesEl.textContent = [...new Set(activities.map(a => a.facility))].length;

    const allOfficers = activities.flatMap(a => a.officers || []);
    totalOfficersEl.textContent = [...new Set(allOfficers)].length;

    const typeCounts = activities.reduce((acc, a) => {
        acc[a.activityType] = (acc[a.activityType] || 0) + 1;
        return acc;
    }, {});

    let maxCount = 0;
    let commonType = '-';
    for (const type in typeCounts) {
        if (typeCounts[type] > maxCount) {
            maxCount = typeCounts[type];
            commonType = type;
        }
    }
    commonActivityEl.textContent = commonType;
}

function renderChart(canvas, chartInstance, config) {
    // Destroy existing chart if it exists
    if (chartInstance) {
        chartInstance.destroy();
    }
    // Check if canvas context exists
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Canvas context not found for chart:", canvas.id);
        return null;
    }
    // Create new chart
    try {
         return new Chart(ctx, config);
    } catch (error) {
        console.error("Error creating chart:", canvas.id, error);
        return null;
    }
}


function renderActivityTypeChart(activities) {
    const typeCounts = activities.reduce((acc, a) => {
        acc[a.activityType] = (acc[a.activityType] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(typeCounts);
    const data = Object.values(typeCounts);

    activityChart = renderChart(activityChartCanvas, activityChart, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Activity Types',
                data: data,
                backgroundColor: [ // Add more colors if needed
                    '#4361ee', '#4cc9f0', '#f72585', '#7209b7',
                    '#3a0ca3', '#4895ef', '#ff9800', '#4caf50',
                    '#f44336', '#9c27b0', '#607d8b', '#cddc39'
                ],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

function renderTimeChart(activities) {
    // Group by day within the selected month
    const activityByDay = activities.reduce((acc, a) => {
        const day = a.date.getDate(); // Get day of the month
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {});

    // Create labels for all days in the month (even if no activity)
    const daysInMonth = new Date(activities[0]?.date.getFullYear() || new Date().getFullYear(), parseInt(reportMonth.value) + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1); // [1, 2, ..., 30/31]
    const data = labels.map(day => activityByDay[day] || 0); // Map counts, default to 0

    timeChart = renderChart(timeChartCanvas, timeChart, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Activities per Day',
                data: data,
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                fill: true,
                tension: 0.1 // Smoother line
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderFacilityChart(activities) {
    const facilityCounts = activities.reduce((acc, a) => {
        acc[a.facility] = (acc[a.facility] || 0) + 1;
        return acc;
    }, {});

     // Sort facilities by count (descending) and take top N if needed
    const sortedFacilities = Object.entries(facilityCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 15); // Limit to top 15 for readability

    const labels = sortedFacilities.map(([facility]) => facility);
    const data = sortedFacilities.map(([, count]) => count);


    facilityChart = renderChart(facilityChartCanvas, facilityChart, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Activities per Facility',
                data: data,
                backgroundColor: '#4cc9f0'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderOfficerChart(activities) {
    const officerCounts = (activities.flatMap(a => a.officers || []))
        .reduce((acc, officer) => {
            acc[officer] = (acc[officer] || 0) + 1;
            return acc;
        }, {});

    // Sort officers by count (descending) and take top N
    const sortedOfficers = Object.entries(officerCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 15); // Limit to top 15

    const labels = sortedOfficers.map(([officer]) => officer);
    const data = sortedOfficers.map(([, count]) => count);

    officerChart = renderChart(officerChartCanvas, officerChart, {
        type: 'bar', // Use 'bar' for Chart.js v3+
        data: {
            labels: labels,
            datasets: [{
                label: 'Activities Participated In',
                data: data,
                backgroundColor: '#7209b7'
            }]
        },
        options: {
            indexAxis: 'y', // Makes it a horizontal bar chart
            responsive: true, maintainAspectRatio: false,
            scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function resetCharts() {
    if (activityChart) activityChart.destroy();
    if (timeChart) timeChart.destroy();
    if (facilityChart) facilityChart.destroy();
    if (officerChart) officerChart.destroy();
    activityChart = null;
    timeChart = null;
    facilityChart = null;
    officerChart = null;
    console.log("Charts reset.");
}

// --- User Management ---
async function checkAdminStatus(user) {
    if (!user) return false;
    try {
        const userDocRef = doc(usersCollection, user.uid);
        const userDoc = await getDoc(userDocRef);
        const isAdminUser = userDoc.exists() && userDoc.data().role === 'admin';
        console.log(`User ${user.email} isAdmin: ${isAdminUser}`);
        return isAdminUser;
    } catch (error) {
        console.error('Error checking admin status:', error);
        showToast("Could not verify user role.", "warning");
        return false;
    }
}

// Simplified isAdmin check using the global currentUser
async function isAdmin() {
    return checkAdminStatus(currentUser);
}


async function loadUsers() {
    try {
        showLoading();
        const querySnapshot = await getDocs(query(usersCollection, orderBy('email')));
        usersBody.innerHTML = ''; // Clear previous list

        querySnapshot.forEach((doc) => {
            const user = doc.data();
            // Do not list the currently logged-in admin themselves for role change/delete
            if (user.uid === currentUser?.uid) return;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.email || 'N/A'}</td>
                <td>
                    <select class="role-select" data-uid="${user.uid}" ${user.role === 'admin' ? 'disabled' : ''}>
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    ${user.role !== 'admin' ? // Prevent deleting other admins easily
                        `<button class="btn-small btn-danger" onclick="deleteUser('${user.uid}', '${user.email}')">
                            <i class="fas fa-user-slash"></i> Delete
                         </button>`
                        : '<span class="disabled-action">Cannot delete admin</span>'
                    }
                </td>
            `;
            usersBody.appendChild(row);
        });

        // Add event listeners for role changes AFTER rows are added
        document.querySelectorAll('.role-select').forEach(select => {
            // Remove existing listener if any to prevent duplicates (safer)
            select.replaceWith(select.cloneNode(true));
        });
        // Re-query and add new listeners
         document.querySelectorAll('.role-select').forEach(select => {
            if (!select.disabled) { // Only add listener to non-disabled selects
                select.addEventListener('change', handleRoleChange);
            }
        });


    } catch (error) {
        showToast(`Error loading users: ${error.message}`, "error");
        console.error("Error loading users:", error);
    } finally {
        hideLoading();
    }
}

async function handleRoleChange(e) {
    const selectElement = e.target;
    const uid = selectElement.getAttribute('data-uid');
    const newRole = selectElement.value;
    const originalRole = selectElement.querySelector(`option[value][selected]`)?.value || (newRole === 'admin' ? 'user' : 'admin'); // Simple guess of original

    if (confirm(`Are you sure you want to change the role for user with UID ${uid} to ${newRole}?`)) {
        try {
            showLoading();
            const userDocRef = doc(usersCollection, uid);
            await updateDoc(userDocRef, { role: newRole });
            showToast("User role updated successfully.", "success");
            // Update the selected attribute visually for immediate feedback
            selectElement.querySelector('option[selected]')?.removeAttribute('selected');
            selectElement.querySelector(`option[value="${newRole}"]`)?.setAttribute('selected', '');
            // Admins cannot have their role changed back easily via UI
             if (newRole === 'admin') {
                 selectElement.disabled = true;
                 // Also disable delete button if applicable
                 const deleteButton = selectElement.closest('tr').querySelector('button.btn-danger');
                 if (deleteButton) {
                     deleteButton.replaceWith(document.createTextNode('Cannot delete admin'));
                 }
            }
        } catch (error) {
            showToast(`Error updating user role: ${error.message}`, "error");
            console.error("Error updating user role:", error);
            // Revert dropdown if error occurred
            selectElement.value = originalRole;
        } finally {
            hideLoading();
        }
    } else {
        // Revert dropdown if user cancels confirmation
        selectElement.value = originalRole;
    }
}

// Make deleteUser globally accessible for the onclick attribute
window.deleteUser = async function (uid, email) {
     // Extra confirmation, mentioning the email
    if (confirm(`ARE YOU ABSOLUTELY SURE?\nThis will permanently delete the user '${email}' (UID: ${uid}) and all their associated data cannot be easily recovered.\n\nThere is no undo.`)) {
        try {
            showLoading();
            // **IMPORTANT:** Deleting the Firestore user document DOES NOT delete the Firebase Auth user.
            // You need a Cloud Function triggered by the Firestore delete, or call an HTTPS callable function
            // from the client (requires admin privileges or specific security rules) to delete the Auth user.
            // For simplicity here, we only delete the Firestore document.
            await deleteDoc(doc(usersCollection, uid));

            // **Recommendation:** Implement a Cloud Function `onUserDeleted` triggered by Firestore delete
            // function onUserDeleted(snap, context) {
            //    const deletedUserUID = context.params.userId;
            //    return admin.auth().deleteUser(deletedUserUID);
            // }

            showToast(`User document for '${email}' deleted from Firestore. Remember to delete the Auth user if needed.`, "success");
            await loadUsers(); // Refresh the user list
        } catch (error) {
            showToast(`Error deleting user document: ${error.message}`, "error");
            console.error("Error deleting user document:", error);
        } finally {
            hideLoading();
        }
    }
};


// --- Firestore Sync Status & Persistence ---
function setupFirestoreSyncStatus() {
    // Check if metadata collection and sync doc exist, create if not? Or handle error.
    const syncDocRef = doc(metadataCollection, "sync");
    onSnapshot(syncDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const statusData = docSnap.data();
            syncStatus.textContent = statusData.status === 'online' ? '✓ Online' : '⚠ Offline';
            syncStatus.className = `sync-status ${statusData.status}`; // Add class for styling
        } else {
            console.warn("Metadata/sync document not found.");
            syncStatus.textContent = '⚠ Status Unknown';
            syncStatus.className = 'sync-status unknown';
        }
    }, (error) => {
         console.error("Error listening to sync status:", error);
         syncStatus.textContent = '⚠ Status Error';
         syncStatus.className = 'sync-status error';
    });
}

function enableFirestorePersistence() {
    enablePersistence(db) // Use the imported function
        .then(() => {
            console.log("Offline persistence enabled.");
        })
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn("Persistence failed: Multiple tabs open?");
                showToast("Offline mode may not work correctly with multiple tabs open.", "warning");
            } else if (err.code === 'unimplemented') {
                console.warn("Persistence failed: Browser not supported.");
                showToast("Your browser doesn't support offline data storage.", "warning");
            } else {
                 console.error("Persistence failed:", err);
                 showToast("Could not enable offline mode.", "error");
            }
        });
}

// --- Export to CSV ---
function exportToCSV() {
    const monthFilterValue = filterMonth.value;
    const typeFilterValue = filterType.value;

    // Use the currently loaded `activities` for export, matching the table view
    const dataToExport = activities.filter(activity => {
        const activityDate = activity.date;
        if (!activityDate) return false;
        const matchMonth = monthFilterValue === '' || activityDate.getMonth() === parseInt(monthFilterValue);
        const matchType = typeFilterValue === '' || activity.activityType === typeFilterValue;
        return matchMonth && matchType;
    });

    if (dataToExport.length === 0) {
        showToast("No data available to export with current filters.", "info");
        return;
    }

    // Prepare CSV content
    let csvContent = 'Date,Facility,Address,Activity Type,Observation/Action,Officers,Recommendation\n';

    dataToExport.forEach(activity => {
        const formattedDate = activity.date.toLocaleDateString();
        // Function to safely quote CSV fields
        const escapeCSV = (field) => {
            const str = String(field === null || field === undefined ? '' : field);
            // Replace quotes with double quotes and wrap in quotes if it contains comma, newline, or quote
            if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const row = [
            formattedDate,
            escapeCSV(activity.facility),
            escapeCSV(activity.address),
            escapeCSV(activity.activityType),
            escapeCSV(activity.observation),
            escapeCSV((activity.officers || []).join(', ')),
            escapeCSV(activity.recommendation)
        ];
        csvContent += row.join(',') + '\n';
    });

    // Create download link
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        link.setAttribute('href', url);
        link.setAttribute('download', `daily_activities_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up blob URL
        showToast("Export successful!", "success");
    } catch (error) {
        showToast("Export failed. See console for details.", "error");
        console.error("CSV Export error:", error);
    }
}

// --- Helper Functions ---
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`; // Ensure CSS targets .toast.success, .toast.error, etc.

    // Choose icon based on type
    let iconClass = 'fa-check-circle'; // Default success
    if (type === 'error') iconClass = 'fa-times-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    if (type === 'info') iconClass = 'fa-info-circle';

    toast.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span>${message}</span>
        <button class="close-toast" onclick="this.parentElement.remove()">×</button>
    `;

    toastContainer.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// --- Global Function for Delete Button ---
// Make deleteActivity globally accessible for the onclick attribute in the table rows
window.deleteActivity = async function (id) {
    if (!currentUser) {
        showToast("You must be logged in.", "error"); return;
    }

    if (confirm('Are you sure you want to permanently delete this activity record?')) {
        try {
            showLoading();
            const activityDocRef = doc(activitiesCollection, id);

            // Optional: Permission Check - Ensure user owns the doc or is admin
            const docSnap = await getDoc(activityDocRef);
            if (!docSnap.exists()) {
                 throw new Error("Activity not found.");
            }
            const activityData = docSnap.data();
            const isAdminUser = await isAdmin();

            if (activityData.userId === currentUser.uid || isAdminUser) {
                await deleteDoc(activityDocRef);
                showToast('Activity deleted successfully.', 'success');

                // Remove from local arrays and refresh UI
                activities = activities.filter(a => a.id !== id);
                allUserActivities = allUserActivities.filter(a => a.id !== id);
                totalActivityCount = Math.max(0, totalActivityCount - 1); // Decrement total count

                // If the deleted item was the last on the page and it's not page 1, go back a page
                if (activities.length === 0 && currentPage > 1) {
                    currentPage--;
                    await loadActivities(); // Load the previous page
                } else {
                   updatePagination(); // Update pagination info
                   renderActivities(); // Re-render current page
                }
                generateReports(); // Update reports

            } else {
                 showToast("Permission Denied: You cannot delete this activity.", "error");
            }

        } catch (error) {
            showToast(`Error deleting activity: ${error.message}`, 'error');
            console.error("Error deleting activity:", error);
        } finally {
            hideLoading();
        }
    }
};


// --- Initialize the application on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', initApp);
