// ======================
// FIREBASE INITIALIZATION
// ======================

// Load Firebase libraries
const firebaseScripts = [
    'https://www.gstatic.com/firebasejs/10.5.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.5.2/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.5.2/firebase-analytics-compat.js'
  ];
  
  // Load scripts sequentially
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  async function loadFirebase() {
    for (const url of firebaseScripts) {
      await loadScript(url);
    }
  }
  
  // ======================
  // MAIN APPLICATION CODE
  // ======================
  
  async function initializeApp() {
    // 1. Load Firebase
    await loadFirebase();
  
    // 2. Firebase Config
    const firebaseConfig = {
      apiKey: "AIzaSyAy8F1-_npmdlqkZnZMh3TgjnLZqPBcg0k",
      authDomain: "dailyactivity-ddd22.firebaseapp.com",
      projectId: "dailyactivity-ddd22",
      storageBucket: "dailyactivity-ddd22.appspot.com",
      messagingSenderId: "190226737067",
      appId: "1:190226737067:web:f24e3765f02485f93094ee",
      measurementId: "G-4YW1XJ8XYQ"
    };
  
    // 3. Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
  
    // 4. Enable Persistence
    db.enablePersistence().catch(err => {
      console.error("Offline support error:", err);
    });
  
    // ======================
    // DOM ELEMENTS
    // ======================
    const elements = {
      loadingOverlay: document.getElementById('loading-overlay'),
      authContainer: document.getElementById('auth-container'),
      appContainer: document.getElementById('app-container'),
      userEmail: document.getElementById('user-email'),
      loginForm: document.getElementById('login-form'),
      registerForm: document.getElementById('register-form'),
      activityForm: document.getElementById('activity-form'),
      recordsBody: document.getElementById('records-body'),
      exportBtn: document.getElementById('export-btn'),
      filterMonth: document.getElementById('filter-month'),
      filterType: document.getElementById('filter-type')
    };
  
    // ======================
    // APP STATE
    // ======================
    let currentUser = null;
    let activities = [];
  
    // ======================
    // AUTHENTICATION
    // ======================
    auth.onAuthStateChanged(user => {
      if (user) {
        currentUser = user;
        handleAuthenticatedUser(user);
      } else {
        handleUnauthenticatedUser();
      }
    });
  
    function handleAuthenticatedUser(user) {
      elements.authContainer.style.display = 'none';
      elements.appContainer.style.display = 'block';
      elements.userEmail.textContent = user.email;
      loadActivities();
    }
  
    function handleUnauthenticatedUser() {
      elements.authContainer.style.display = 'block';
      elements.appContainer.style.display = 'none';
      currentUser = null;
      activities = [];
    }
  
    // ======================
    // DATA MANAGEMENT
    // ======================
    async function loadActivities() {
      try {
        showLoading();
        const snapshot = await db.collection('activities')
          .where('userId', '==', currentUser.uid)
          .orderBy('date', 'desc')
          .get();
        
        activities = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate()
        }));
        
        renderActivities();
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        hideLoading();
      }
    }
  
    // ======================
    // CSV EXPORT FUNCTIONALITY
    // ======================
    elements.exportBtn.addEventListener('click', exportToCSV);
  
    function exportToCSV() {
      if (activities.length === 0) {
        showToast("No data to export", "warning");
        return;
      }
  
      // Get filtered data based on current filters
      const filteredActivities = getFilteredActivities();
      
      // Prepare CSV headers
      const headers = [
        'Date', 'Facility', 'Address', 'Activity Type', 
        'Observation', 'Officers', 'Recommendation'
      ];
      
      // Prepare CSV rows
      const rows = filteredActivities.map(activity => {
        return [
          formatDateForCSV(activity.date),
          escapeCSV(activity.facility),
          escapeCSV(activity.address),
          escapeCSV(activity.activityType),
          escapeCSV(activity.observation),
          escapeCSV(activity.officers.join(', ')),
          escapeCSV(activity.recommendation)
        ];
      });
  
      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');
  
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `activities_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast("CSV exported successfully", "success");
    }
  
    function getFilteredActivities() {
      const monthFilter = elements.filterMonth.value;
      const typeFilter = elements.filterType.value;
      
      return activities.filter(activity => {
        const matchesMonth = monthFilter === '' || 
          activity.date.getMonth() === parseInt(monthFilter);
        const matchesType = typeFilter === '' || 
          activity.activityType === typeFilter;
        return matchesMonth && matchesType;
      });
    }
  
    function formatDateForCSV(date) {
      return date.toISOString().split('T')[0];
    }
  
    function escapeCSV(str) {
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }
  
    // ======================
    // HELPER FUNCTIONS
    // ======================
    function showLoading() {
      elements.loadingOverlay.style.display = 'flex';
    }
  
    function hideLoading() {
      elements.loadingOverlay.style.display = 'none';
    }
  
    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
        ${message}
        <span class="close" onclick="this.parentElement.remove()">×</span>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }
  
    // ======================
    // INITIALIZE APP
    // ======================
    hideLoading();
    document.getElementById('date').valueAsDate = new Date();
    elements.exportBtn.addEventListener('click', exportToCSV);
  }
  
  // Start the app when DOM is ready
  document.addEventListener('DOMContentLoaded', initializeApp);