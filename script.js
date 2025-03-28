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
  orderBy
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
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
  storageBucket: "dailyactivity-ddd22.appspot.com",
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

    activities = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const firestoreTimestamp = data.date;
      const jsDate = firestoreTimestamp.toDate(); // Convert Firestore Timestamp to JavaScript Date
      const formattedDate = jsDate.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'

      return {
        id: doc.id,
        ...data,
        date: formattedDate
      };
    });

    renderRecords();
    if (document.getElementById('reports').classList.contains('active')) {
      generateReports();
    }
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
      timestamp: new Date()
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
      const docRef = doc(db, "activities", id);
      await deleteDoc(docRef);

      // Remove from local array
      activities = activities.filter(activity => activity.id !== id);

      // Refresh records display
      renderRecords();
    } catch (error) {
      console.error("Error deleting document: ", error);
      alert("Error deleting activity. Please check console for details.");
    }
  }
}

// Export to CSV
function exportToCSV() {
  // Implementation of exportToCSV function
}

// Generate reports
function generateReports() {
  // Implementation of generateReports function
}
 
