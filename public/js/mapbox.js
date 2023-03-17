/* eslint-disable */

export const displayMap = (locations) => {
  mapboxgl.accessToken =
    'pk.eyJ1IjoiZmxhc2hiYWNrMDU0IiwiYSI6ImNsZWgwcnB3ajB0czIzc21xN3d3a3dieTcifQ.B75fA-5_GRJGJba3uKxicA';
  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/flashback054/cleh7vyjh000e01qvn6m34hbo',
    scrollZoom: false,
    // interactive: false,
    // center: [-118.133491, 34.111745],
    // zoom: 10,
  });

  let bounds = new mapboxgl.LngLatBounds();

  locations.forEach((loc) => {
    // Create Marker
    const el = document.createElement('div');
    el.className = 'marker';

    // Add Marker
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // Add Popup
    new mapboxgl.Popup({
      offset: 30,
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    // Extend current bounds
    bounds.extend(loc.coordinates);
  });

  map.fitBounds(bounds, {
    padding: {
      top: 200,
      bottom: 150,
      left: 100,
      right: 100,
    },
  });
};
