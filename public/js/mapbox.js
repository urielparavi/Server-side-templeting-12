/* eslint-disable */

export const displayMap = (locations) => {
  mapboxgl.accessToken =
    'pk.eyJ1IjoidXJpZWxwYSIsImEiOiJjbTRzaXhjbmYwMTNpMnBxeWNxcXFpNGZjIn0.v-ZcJ_vnGfqkmFOr_PIoyA';

  var map = new mapboxgl.Map({
    container: 'map',
    // style => the style of the map we using
    style: 'mapbox://styles/urielpa/cm4skkhe4000101scf53s08no',
    scrollZoom: false,
    // center: [-118.241754, 34.083021],
    // zoom: 10,
    // interactive: false,
  });

  // fit bounds method => moves and zoom the map right to the bounds to fit our markers
  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((loc) => {
    // Create marker
    const el = document.createElement('div');
    el.className = 'marker';

    // Add marker => <div class="marker"></div>
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // Add popup
    new mapboxgl.Popup({
      offset: 30,
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    // Extend map bounds include current location
    bounds.extend(loc.coordinates);
  });

  // We customize the fit bounds for our locations
  map.fitBounds(bounds, {
    padding: {
      top: 200,
      bottom: 150,
      left: 100,
      right: 100,
    },
  });
};

// #map(data-locations=`${JSON.stringify(tour.locations)}`)

{
  /* <div id="map" data-locations="[
      {
        "_id": "5c88fa8cf4afda39709c2960",
        "description": "New York",
        "type": "Point",
        "coordinates": [-73.967696, 40.781821],
        "day": 1
      },
      {
        "_id": "5c88fa8cf4afda39709c295f",
        "description": "Los Angeles",
        "type": "Point",
        "coordinates": [-118.324396, 34.097984],
        "day": 3
      },
      {
        "_id": "5c88fa8cf4afda39709c295e",
        "description": "San Francisco",
        "type": "Point",
        "coordinates": [-122.408865, 37.787825],
        "day": 5
      }
    ]"></div> */
}
