import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Map, View, Feature } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { FeatureLike } from 'ol/Feature';
import Style from 'ol/style/Style.js';

@Component({
  selector: 'app-root',
  standalone: true, // Mark as standalone
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  map!: Map;
  vectorLayer!: VectorLayer<any>;
  graveyards: string[] = [];
  statusColorMap: { [key: string]: string } = {}; // Map grabstatus to colors
  TotalGraveyards: number[] = [];

  // Predefined color palette (expand as needed)
  private colors = [
    'red',
    'green',
    'blue',
    'yellow',
    'purple',
    'orange',
    'cyan',
    'pink',
    'teal',
    'lime',
    'indigo',
    'gray',
  ];

  ngOnInit() {
    this.initializeMap();
    this.loadGeoJSON();
    this.loadGeoJSON2();
  }

  initializeMap() {
    this.map = new Map({
      target: 'map',
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: [6990990, 3300000],
        zoom: 5,
      }),
    });
  }

  loadGeoJSON2() {
    fetch(`https://wipperfuerth.pgconnect.de/api/v1/webgis/friedhof`)
      .then((response) => response.json())
      .then((data) => {
        console.log('vectorSorce...newdata', data);
        console.log('vectorSorce...newdata.length', data.length);
        console.log('vectorSorce...newdata.length', data.friedhofId);
        const graveYardName = new Set<string>();
        data.forEach((data: any) => {
          const named = data.friedhof;
          const friedhofId = data.friedhofId;
          if (named) graveYardName.add(named);
          if (friedhofId) graveYardName.add(friedhofId);
        });
        console.log('gravedyardname', graveYardName);
      });
  }

  loadGeoJSON() {
    fetch('assets/graves.geojson')
      .then((response) => response.json())
      .then((data) => {
        const vectorSource = new VectorSource({
          features: new GeoJSON().readFeatures(data, {
            featureProjection: 'EPSG:3857',
          }),
        });

        const graveyardSet = new Set<string>();
        const buschhovenGraves = new Set<string>();
        const unassignedByGraveyard: { [key: string]: number } = {};
        let sampleProperties: string[] = [];
        const statusSet = new Set<string>();
        const grabstelleSet = new Set<string>();

        vectorSource.getFeatures().forEach((feature) => {
          const graveyard = feature.get('friedhof');
          const grabId = feature.get('grabId');
          const verstorbene = feature.get('verstorbene');
          const grabStatus = feature.get('grabstatus');
          const grabStelle = feature.get('grabstelle');

          if (grabStatus) statusSet.add(grabStatus);

          if (grabStelle) grabstelleSet.add(grabStelle);

          // Q1: Count unique graveyards
          if (graveyard) graveyardSet.add(graveyard);

          // Q2: Count graves in Buschhoven
          if (graveyard === 'Buschhoven' && grabId)
            buschhovenGraves.add(grabId);

          // Q3: Get properties (once, from first feature)
          if (sampleProperties.length === 0) {
            sampleProperties = Object.keys(feature.getProperties());
          }

          // Q4: Count unassigned grave plots per graveyard (no verstorbene)
          if (!verstorbene) {
            unassignedByGraveyard[graveyard] =
              (unassignedByGraveyard[graveyard] || 0) + 1;
          }
        });

        console.log('statusSet...', statusSet);
        console.log('grabstelleSet...', grabstelleSet);
        // Task 1 Answers
        console.log('Q1: Number of graveyards:', graveyardSet.size);
        console.log(
          'Q2: Number of graves in Buschhoven:',
          buschhovenGraves.size
        );
        console.log(
          'Q3: Properties attached to a grave plot:',
          sampleProperties
        );

        const mostUnassignedGraveyard = Object.keys(
          unassignedByGraveyard
        ).reduce((a, b) =>
          unassignedByGraveyard[a] > unassignedByGraveyard[b] ? a : b
        );
        console.log(
          `Q4: Graveyard with most unassigned plots:,
          ${mostUnassignedGraveyard},
          with,
          ${unassignedByGraveyard[mostUnassignedGraveyard]},
          unassigned plots`
        );

        // Map each unique status to a color
        const statuses = Array.from(statusSet);
        statuses.forEach((status, index) => {
          this.statusColorMap[status] = this.colors[index % this.colors.length];
        });
        console.log('statuses...', statuses);

        this.vectorLayer = new VectorLayer({
          source: vectorSource,
          style: (feature) => this.styleFunction(feature),
        });

        if (this.map) {
          this.map.addLayer(this.vectorLayer);
        }

        this.graveyards = Array.from(graveyardSet);
        console.log('this . graveyard..', this.graveyards);
      });
  }

  styleFunction(feature: FeatureLike) {
    const grabstatus = feature.get('grabstatus') || 'unknown'; // Fallback for null/undefined
    const color = this.statusColorMap[grabstatus] || 'gray'; // Default to gray if not found

    return new Style({
      fill: new Fill({ color }),
      stroke: new Stroke({ color: 'black', width: 1 }),
    });
  }

  zoomToGraveyard(event: Event) {
    const selectedGraveyard = (event.target as HTMLSelectElement).value;
    if (!selectedGraveyard) return;

    const features = this.vectorLayer.getSource().getFeatures();
    const selectedFeature = features.find(
      (f: Feature) => f.get('friedhof') === selectedGraveyard
    );
    if (selectedFeature) {
      const geometry = selectedFeature.getGeometry();
      this.map
        .getView()
        .fit(geometry.getExtent(), { duration: 1000, maxZoom: 20 });
    }
  }
}
