// --- Firebase Imports (Compat Mode) ---
import firebase from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore-compat.js";
import "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth-compat.js";
import "https://www.gstatic.com/firebasejs/10.5.2/firebase-analytics-compat.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyAy8F1-_npmdlqkZnZMh3TgjnLZqPBcg0k",
    authDomain: "dailyactivity-ddd22.firebaseapp.com",
    projectId: "dailyactivity-ddd22",
    storageBucket: "dailyactivity-ddd22.appspot.com",
    messagingSenderId: "190226737067",
    appId: "1:190226737067:web:f24e3765f02485f93094ee",
    measurementId: "G-4YW1XJ8XYQ"
};

// --- Initialize Firebase ---
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const analytics = firebase.analytics();

// --- DOM Elements ---
const loadingOverlay = document.getElementById('loading-overlay');
const toastContainer = document.getElementById('toast-container');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const userEmailDisplay = document.getElementById('user-email');
const syncStatus = document.getElementById('sync-status');
const logoutBtn = document.getElementById('logout-btn');
const activityForm = document.getElementById('activity-form');
const dateInput = document.getElementById('date');
const recordsBody = document.getElementById('records-body');
const usersBody = document.getElementById('users-body');

// --- App State ---
let currentUser = null;
let activities = [];
let currentPage = 1;
const itemsPerPage = 15;
let activityChart = null, timeChart = null, facilityChart = null, officerChart = null;

// --- Initialize App ---
function initApp() {
    setupEventListeners();
    setupAuthStateObserver();
    enableFirestorePersistence();
    
    // Set default date
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
    document.getElementById('report-month').value = today.getMonth();
    
    hideLoading();
}

// --- Auth State Management ---
function setupAuthStateObserver() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await handleAuthenticatedUser(user);
        } else {
            handleUnauthenticatedUser();
        }
    });
}

async function handleAuthenticatedUser(user) {
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    userEmailDisplay.textContent = user.email;
    
    if (!user.emailVerified) {
        showToast('Please verify your email', 'warning');
    }

    // Check admin status
    const isAdmin = await checkAdminStatus(user);
    document.getElementById('users-tab').style.display = isAdmin ? 'block' : 'none';
    
    await loadActivities();
}

function handleUnauthenticatedUser() {
    authContainer.style.display = 'block';
    appContainer.style.display = 'none';
    resetAppState();
}

// --- Firestore Operations ---
async function loadActivities() {
    try {
        showLoading();
        
        let query = db.collection('activities').orderBy('timestamp', 'desc');
        
        if (!(await isAdmin())) {
            query = query.where('userId', '==', currentUser.uid);
        }

        const snapshot = await query.get();
        activities = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate()
        }));

        renderActivities();
        generateReports();
    } catch (error) {
        showToast(`Error loading data: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// --- Activity Form Handling ---
async function handleActivitySubmission(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showToast("Please login first", "error");
        return;
    }

    const newActivity = {
        date: new Date(dateInput.value),
        facility: document.getElementById('facility').value.trim(),
        address: document.getElementById('address').value.trim(),
        activityType: document.getElementById('activityType').value,
        observation: document.getElementById('observation').value.trim(),
        officers: document.getElementById('officers').value.split(',').map(o => o.trim()),
        recommendation: document.getElementById('recommendation').value.trim(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: currentUser.uid,
        userEmail: currentUser.email
    };

    try {
        showLoading();
        await db.collection('activities').add(newActivity);
        showToast('Activity saved!', 'success');
        activityForm.reset();
        dateInput.value = new Date().toISOString().split('T')[0];
        await loadActivities();
    } catch (error) {
        showToast(`Save failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// --- Chart Functions ---
function generateReports() {
    const month = parseInt(document.getElementById('report-month').value);
    const monthActivities = activities.filter(a => a.date?.getMonth() === month);
    
    updateSummaryStats(monthActivities);
    renderCharts(monthActivities);
}

function renderCharts(activities) {
    // Destroy existing charts
    [activityChart, timeChart, facilityChart, officerChart].forEach(chart => {
        if (chart) chart.destroy();
    });

    // Activity Type Chart
    const typeCounts = {};
    activities.forEach(a => typeCounts[a.activityType] = (typeCounts[a.activityType] || 0) + 1);
    activityChart = new Chart(document.getElementById('activity-chart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{ data: Object.values(typeCounts) }]
        }
    });

    // Time Chart (activities per day)
    const dayCounts = Array(31).fill(0);
    activities.forEach(a => {
        if (a.date) dayCounts[a.date.getDate() - 1]++;
    });
    timeChart = new Chart(document.getElementById('time-chart'), {
        type: 'line',
        data: {
            labels: Array.from({length: 31}, (_, i) => i + 1),
            datasets: [{ data: dayCounts }]
        }
    });
}

// --- Helper Functions ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-times-circle' : 'fa-check-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', initApp);

// Make functions available globally for HTML onclick handlers
window.deleteActivity = async function(id) {
    if (confirm('Delete this activity?')) {
        try {
            showLoading();
            await db.collection('activities').doc(id).delete();
            await loadActivities();
            showToast('Activity deleted', 'success');
        } catch (error) {
            showToast(`Delete failed: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    }
};