// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

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
  storageBucket: "dailyactivity-ddd22.appspot.com",
  messagingSenderId: "190226737067",
  appId: "1:190226737067:web:f24e3765f02485f93094ee",
  measurementId: "G-4YW1XJ8XYQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Activities collection reference
const activitiesCollection = collection(db, "activities");

// Set default date to today
document.getElementById('date').valueAsDate = new Date();

// Set default report month to current month
const currentMonth = new Date().getMonth();
reportMonth.value = currentMonth;

// Global activities array
let activities = [];

// Helper function to format Firestore Timestamp or date string
function formatActivityDate(date) {
  // If it's a Firestore Timestamp
  if (date instanceof Timestamp) {
    return date.toDate();
  }
  // If it's already a Date object
  if (date instanceof Date) {
    return date;
  }
  // If it's an ISO string
  if (typeof date === 'string') {
    return new Date(date);
  }
  // Fallback to current date
  return new Date();
}

// Load activities from Firestore
async function loadActivities() {
  try {
    const q = query(activitiesCollection, orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    
    activities = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Properly handle the date field
        date: formatActivityDate(data.date)
      };
    });
    
    renderRecords();
  } catch (error) {
    console.error("Error loading activities: ", error);
    alert("Error loading activities. Please check console for details.");
  }
}

// ... [keep all your existing tab switching, form submission code unchanged until renderRecords]

// Render records with filters
function renderRecords() {
  const monthFilter = filterMonth.value;
  const typeFilter = filterType.value;
  
  // Filter activities based on selected filters
  const filteredActivities = activities.filter(activity => {
    const activityDate = activity.date; // Already a Date object
    const matchMonth = monthFilter === '' || activityDate.getMonth() === parseInt(monthFilter);
    const matchType = typeFilter === '' || activity.activityType === typeFilter;
    
    return matchMonth && matchType;
  });
  
  // Sort by date (most recent first)
  filteredActivities.sort((a, b) => b.date - a.date);
  
  // Clear table
  recordsBody.innerHTML = '';
  
  // Populate table
  filteredActivities.forEach(activity => {
    const row = document.createElement('tr');
    
    // Format date for display (DD/MM/YYYY format)
    const formattedDate = activity.date.toLocaleDateString('en-GB');
    
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

// ... [keep all your existing deleteActivity, exportToCSV code unchanged until generateReports]

// Generate reports and charts
function generateReports() {
  const selectedMonth = parseInt(reportMonth.value);
  
  // Filter activities for the selected month
  const monthActivities = activities.filter(activity => {
    return activity.date.getMonth() === selectedMonth;
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
    // Use ISO date string (YYYY-MM-DD) as key
    const dateKey = activity.date.toISOString().split('T')[0];
    activityByDay[dateKey] = (activityByDay[dateKey] || 0) + 1;
  });
  
  // Sort dates chronologically
  const sortedDates = Object.keys(activityByDay).sort();
  
  const ctx = document.getElementById('time-chart').getContext('2d');
  
  // Destroy existing chart if it exists
  if (window.timeChart) {
    window.timeChart.destroy();
  }
  
  window.timeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates.map(date => new Date(date).toLocaleDateString('en-GB')),
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
        },
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: 10
          }
        }
      }
    }
  });
}

// Initial load of data
loadActivities();