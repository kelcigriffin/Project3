let data; // Declare the data variable in a higher scope
let filteredGeoJSON; // Declare variable to store filtered GeoJSON data
let stateMapping = {}; // Declare variable to store the mapping between state_abbr and name
let map; // Declare the map variable in a higher scope

document.addEventListener('DOMContentLoaded', () => {
  fetchDataAndInitialize();
});

async function fetchDataAndInitialize() {
  try {
    const [crimeResponse, geoJSONResponse] = await Promise.all([
      fetch('../Visualizations/Data/data_with_coordinates.json'),
      fetch('../Visualizations/Data/us-states.json') // Replace with your GeoJSON file
    ]);

    if (!crimeResponse.ok || !geoJSONResponse.ok) {
      throw new Error(`HTTP error! Status: ${crimeResponse.status} or ${geoJSONResponse.status}`);
    }

    const [crimeData, geoJSONData] = await Promise.all([crimeResponse.json(), geoJSONResponse.json()]);

    if (!Array.isArray(crimeData)) {
      throw new Error('Invalid JSON format for crime data');
    }

    // Store the mapping between state_abbr and name
    stateMapping = geoJSONData.features.reduce((acc, feature) => {
      acc[feature.properties.STATE] = feature.properties.NAME;
      return acc;
    }, {});

    // Store the filtered GeoJSON data
    filteredGeoJSON = geoJSONData;

    initializeDropdowns(crimeData);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

function initializeDropdowns(crimeData) {
  // Assign the data to the variable in the higher scope
  data = crimeData;

  // Initialize Leaflet map
  map = L.map('map').setView([37.8, -96], 4);

  // Add a tile layer (OpenStreetMap as an example)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
  }).addTo(map);

  // Extract unique crimes and years
  const uniqueCrimes = Object.keys(crimeData[0]).filter(key => key.endsWith('_rate') && key !== 'Unemployment_Rate');
  const uniqueYears = Array.from(new Set(crimeData.map(entry => entry.data_year)));

  // Populate crime dropdown
  uniqueCrimes.forEach(crime => {
    const option = document.createElement('option');
    option.value = crime;
    option.textContent = crime.replace('_rate', ''); // Display without '_rate'
    crimeSelector.appendChild(option);
  });

  // Populate year dropdown
  uniqueYears.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelector.appendChild(option);
  });

  // Add event listeners to dropdowns for updating the map
  crimeSelector.addEventListener('change', updateMap);
  yearSelector.addEventListener('change', updateMap);

  // Initial map rendering
  updateMap();
}

function updateMap() {
  // Add logic to filter data based on dropdown selections
  const selectedCrime = d3.select('#crimeSelector').node().value;
  const selectedYear = d3.select('#yearSelector').node().value;

  // Check if selectedCrime and selectedYear are valid
  if (!selectedCrime || !selectedYear) {
    console.error('Please select both crime type and year.');
    return;
  }

  // Filter your data based on selectedCrime and selectedYear
  const filteredData = data.filter(
    d => d[selectedCrime] !== undefined && d.data_year === +selectedYear
  );

  // Check if data is found for the selected crime and year
  if (filteredData.length === 0) {
    console.warn('No data found for the selected crime and year.');
    return;
  }

  // Now, let's extract the latitude, longitude, and state abbreviation from the GeoJSON
  const geoJSONData = filteredGeoJSON.features.map(feature => ({
    latitude: feature.geometry.coordinates[1],
    longitude: feature.geometry.coordinates[0],
    state_abbr: feature.properties.STATE,
    name: stateMapping[feature.properties.STATE] // Add the name property using the mapping
  }));

  console.log('Selected Crime:', selectedCrime);
  console.log('Selected Year:', selectedYear);
  console.log('Filtered Data:', filteredData);
  console.log('GeoJSON Data:', geoJSONData);

  try {
    // Clear previous markers
    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        layer.remove();
      }
    });

    // Find the maximum values for crime rate and unemployment rate
    const maxCrimeRate = d3.max(filteredData, d => d[selectedCrime]);

    // Loop through the filtered data
filteredData.forEach(entry => {
  const crimeRate = entry[selectedCrime];

  // Check if coordinates are defined
  if (entry.latitude !== undefined && entry.longitude !== undefined) {
    // Calculate combined score based on crime rate
    const combinedScore = crimeRate / maxCrimeRate;

    // Format crime rate with commas and round to two decimal places with percentage symbol
const formattedCrimeRate = (crimeRate).toLocaleString('en-US', {
  //style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// Format unemployment rate with commas and round to two decimal places with percentage symbol
const formattedUnemploymentRate = (entry.Unemployment_Rate / 100).toLocaleString('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

    // Format population with commas
    const formattedPopulation = entry.Population.toLocaleString('en-US');

    // Create a circle marker for each data point
    const circle = L.circleMarker([entry.latitude, entry.longitude], {
      radius: Math.sqrt(entry.Population) * 0.008, // Adjust the scaling factor as needed
      color: `rgba(0, 0, 255, ${combinedScore})`, // Adjust color based on combined score
      fillColor: `rgba(0, 0, 255, ${combinedScore})`,
      fillOpacity: 0.5,
    });

   // Bind a popup with information
   circle.bindPopup(`
   <strong>${entry.state_abbr}</strong><br>
   Population: ${entry.Population.toLocaleString()}<br>
   ${selectedCrime.replace('_rate', '')} Rate: ${formattedCrimeRate}<br>
   Unemployment Rate: ${formattedUnemploymentRate}
 `);

    // Add the circle marker to the map
    circle.addTo(map);
  } else {
    console.warn('Skipping entry with undefined coordinates:', entry);
  }
});

  } catch (error) {
    console.error('Error processing GeoJSON data:', error);
  }
}



