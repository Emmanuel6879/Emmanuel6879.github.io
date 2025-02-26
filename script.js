// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-analytics.js";

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const activityForm = document.getElementById('activity-form');
const recordsBody = document.getElementById('records-body');
const filterMonth = document.getElementById('filter-month');
const filterType = document.getElementById('filter-type');
const exportBtn = document.getElementById('export-btn');
const reportMonth = document.getElementById('report-month');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAy8F1-_npmdlqkZnZMh3TgjnLZqPBcg0k",
  authDomain: "dailyactivity-ddd22.firebaseapp.com",
  projectId: "dailyactivity-ddd22",
  storageBucket: "dailyactivity-ddd22.firebasestorage.app",
  messagingSenderId: "190226737067",
  appId: "1:190226737067:web:f24e3765f02485f93094ee",
  measurementId: "G-4YW1XJ8XYQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// Activities collection reference
const activitiesCollection = collection(db, "activities");

// Set default date to today
document.getElementById('date').valueAsDate = new Date();

// Set default report month to current month
const currentMonth = new Date().getMonth();
reportMonth.value = currentMonth;

// Global activities array
let activities = [];

// Load activities from Firestore
async function loadActivities() {
  try {
    const q = query(activitiesCollection, orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    
    activities = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to string for date field if needed
      date: doc.data().date instanceof Date ? doc.data().date.toISOString().split('T')[0] : doc.data().date
    }));
    
    renderRecords();
  } catch (error) {
    console.error("Error loading activities: ", error);
    alert("Error loading activities. Please check console for details.");
  }
}

// Tab switching functionality
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(tc => tc.classList.remove('active'));
    
    tab.classList.add('active');
    const tabId = tab.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');
    
    if (tabId === 'records') {
      renderRecords();
    } else if (tabId === 'reports') {
      generateReports();
    }
  });
});

// Form submission
activityForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const dateValue = document.getElementById('date').value;
    const newActivity = {
      date: dateValue,
      facility: document.getElementById('facility').value,
      address: document.getElementById('address').value,
      activityType: document.getElementById('activityType').value,
      observation: document.getElementById('observation').value,
      officers: document.getElementById('officers').value.split(',').map(o => o.trim()),
      recommendation: document.getElementById('recommendation').value,
      timestamp: new Date() // Add timestamp for sorting
    };
    
    // Add to Firestore
    const docRef = await addDoc(activitiesCollection, newActivity);
    console.log("Document written with ID: ", docRef.id);
    
    // Add to local array with the new ID
    activities.push({
      id: docRef.id,
      ...newActivity
    });
    
    // Reset form
    activityForm.reset();
    document.getElementById('date').valueAsDate = new Date();
    
    // Show success message
    alert('Activity logged successfully!');
    
    // Refresh records display
    renderRecords();
  } catch (error) {
    console.error("Error adding document: ", error);
    alert("Error saving activity. Please check console for details.");
  }
});

// Filter change event
filterMonth.addEventListener('change', renderRecords);
filterType.addEventListener('change', renderRecords);

// Export to CSV
exportBtn.addEventListener('click', exportToCSV);

// Report month change event
reportMonth.addEventListener('change', generateReports);

// Render records with filters
function renderRecords() {
  const monthFilter = filterMonth.value;
  const typeFilter = filterType.value;
  
  // Filter activities based on selected filters
  const filteredActivities = activities.filter(activity => {
    const activityDate = new Date(activity.date);
    const matchMonth = monthFilter === '' || activityDate.getMonth() === parseInt(monthFilter);
    const matchType = typeFilter === '' || activity.activityType === typeFilter;
    
    return matchMonth && matchType;
  });
  
  // Sort by date (most recent first)
  filteredActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Clear table
  recordsBody.innerHTML = '';
  
  // Populate table
  filteredActivities.forEach(activity => {
    const row = document.createElement('tr');
    
    // Format date for display
    const formattedDate = new Date(activity.date).toLocaleDateString();
    
    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>${activity.facility}</td>
      <td>${activity.activityType}</td>
      <td>${activity.observation.substring(0, 50)}${activity.observation.length > 50 ? '...' : ''}</td>
      <td>${activity.officers.join(', ')}</td>
      <td class="actions">
        <button class="btn-small btn-danger" onclick="deleteActivity('${activity.id}')">Delete</button>
      </td>
    `;
    
    recordsBody.appendChild(row);
  });
}

// Delete activity - exposing to global scope for onclick handler
window.deleteActivity = async function(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "activities", id));
      
      // Remove from local array
      activities = activities.filter(activity => activity.id !== id);
      
      // Refresh display
      renderRecords();
      
      console.log("Document successfully deleted!");
    } catch (error) {
      console.error("Error removing document: ", error);
      alert("Error deleting activity. Please check console for details.");
    }
  }
};

// Export to CSV
function exportToCSV() {
  const monthFilter = filterMonth.value;
  const typeFilter = filterType.value;
  
  // Filter activities based on selected filters
  const filteredActivities = activities.filter(activity => {
    const activityDate = new Date(activity.date);
    const matchMonth = monthFilter === '' || activityDate.getMonth() === parseInt(monthFilter);
    const matchType = typeFilter === '' || activity.activityType === typeFilter;
    
    return matchMonth && matchType;
  });
  
  // Prepare CSV content
  let csvContent = 'Date,Facility,Address,Activity Type,Observation/Action,Officers,Recommendation\n';
  
  filteredActivities.forEach(activity => {
    const formattedDate = new Date(activity.date).toLocaleDateString();
    const row = [
      formattedDate,
      `"${activity.facility.replace(/"/g, '""')}"`,
      `"${activity.address ? activity.address.replace(/"/g, '""') : ''}"`,
      `"${activity.activityType.replace(/"/g, '""')}"`,
      `"${activity.observation.replace(/"/g, '""')}"`,
      `"${activity.officers.join(', ').replace(/"/g, '""')}"`,
      `"${activity.recommendation ? activity.recommendation.replace(/"/g, '""') : ''}"`
    ];
    
    csvContent += row.join(',') + '\n';
  });
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'activities_report.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generate reports and charts
function generateReports() {
  const selectedMonth = parseInt(reportMonth.value);
  
  // Filter activities for the selected month
  const monthActivities = activities.filter(activity => {
    const activityDate = new Date(activity.date);
    return activityDate.getMonth() === selectedMonth;
  });
  
  // Calculate summary statistics
  const totalActivities = monthActivities.length;
  
  const uniqueFacilities = [...new Set(monthActivities.map(a => a.facility))].length;
  
  const allOfficers = monthActivities.flatMap(a => a.officers);
  const uniqueOfficers = [...new Set(allOfficers)].length;
  
  // Find most common activity type
  const activityTypes = monthActivities.map(a => a.activityType);
  const typeCount = {};
  let maxCount = 0;
  let mostCommonType = '-';
  
  activityTypes.forEach(type => {
    typeCount[type] = (typeCount[type] || 0) + 1;
    if (typeCount[type] > maxCount) {
      maxCount = typeCount[type];
      mostCommonType = type;
    }
  });
  
  // Update summary statistics display
  document.getElementById('total-activities').textContent = totalActivities;
  document.getElementById('unique-facilities').textContent = uniqueFacilities;
  document.getElementById('total-officers').textContent = uniqueOfficers;
  document.getElementById('common-activity').textContent = totalActivities > 0 ? mostCommonType : '-';
  
  // Generate charts
  generateActivityTypeChart(monthActivities);
  generateTimeChart(monthActivities);
}

// Generate activity type distribution chart
function generateActivityTypeChart(activities) {
  const activityTypes = ['GDP Inspection', 'Routine surveillance', 'Consumer Investigation', 'Consultative meeting', 'GLSI Inspection', 'Other'];
  const counts = activityTypes.map(type => {
    return activities.filter(a => a.activityType === type).length;
  });
  
  const ctx = document.getElementById('activity-chart').getContext('2d');
  
  // Destroy existing chart if it exists
  if (window.activityChart) {
    window.activityChart.destroy();
  }
  
  window.activityChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: activityTypes,
      datasets: [{
        data: counts,
        backgroundColor: [
          '#4361ee',
          '#4caf50',
          '#ff9800',
          '#f44336',
          '#9c27b0',
          '#607d8b'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right'
        }
      }
    }
  });
}

// Generate activities over time chart
function generateTimeChart(activities) {
  // Group activities by day
  const activityByDay = {};
  
  activities.forEach(activity => {
    const date = activity.date;
    activityByDay[date] = (activityByDay[date] || 0) + 1;
  });
  
  // Sort dates
  const sortedDates = Object.keys(activityByDay).sort();
  
  const ctx = document.getElementById('time-chart').getContext('2d');
  
  // Destroy existing chart if it exists
  if (window.timeChart) {
    window.timeChart.destroy();
  }
  
  window.timeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates.map(date => new Date(date).toLocaleDateString()),
      datasets: [{
        label: 'Number of Activities',
        data: sortedDates.map(date => activityByDay[date]),
        borderColor: '#4361ee',
        backgroundColor: 'rgba(67, 97, 238, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

// Initial load of data
loadActivities();