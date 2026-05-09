// Type augmentations for the Google Maps 3D Web Components (alpha)
// https://developers.google.com/maps/documentation/javascript/3d-maps-overview

import type { CameraPosition } from "./trip";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "gmp-map-3d": React.DetailedHTMLProps<
        React.HTMLAttributes<GmpMap3DElement> & {
          center?: string;
          tilt?: string | number;
          heading?: string | number;
          range?: string | number;
          "default-labels-disabled"?: boolean;
          "roll"?: string | number;
        },
        GmpMap3DElement
      >;
      "gmp-marker-3d": React.DetailedHTMLProps<
        React.HTMLAttributes<GmpMarker3DElement> & {
          position?: string;
          label?: string;
          "altitude-mode"?:
            | "absolute"
            | "clamp-to-ground"
            | "relative-to-ground"
            | "relative-to-mesh";
          "extruded"?: boolean;
          "draws-when-occluded"?: boolean;
        },
        GmpMarker3DElement
      >;
      "gmp-polyline-3d": React.DetailedHTMLProps<
        React.HTMLAttributes<GmpPolyline3DElement> & {
          "altitude-mode"?:
            | "absolute"
            | "clamp-to-ground"
            | "relative-to-ground"
            | "relative-to-mesh";
          "stroke-color"?: string;
          "stroke-width"?: string | number;
          "stroke-opacity"?: string | number;
          "draws-when-occluded"?: boolean;
          "geodesic"?: boolean;
        },
        GmpPolyline3DElement
      >;
    }
  }

  interface GmpMap3DElement extends HTMLElement {
    center: google.maps.LatLngLiteral & { altitude?: number };
    tilt: number;
    heading: number;
    range: number;
    flyCameraTo(options: {
      endCamera: CameraPosition;
      durationMilliseconds?: number;
    }): void;
    flyCameraAround(options: {
      camera: CameraPosition;
      durationMilliseconds?: number;
      rounds?: number;
    }): void;
    stopCameraAnimation(): void;
    addEventListener(
      type: "gmp-animationend",
      listener: EventListenerOrEventListenerObject
    ): void;
  }

  interface GmpMarker3DElement extends HTMLElement {
    position: google.maps.LatLngLiteral & { altitude?: number };
    label: string;
  }

  interface GmpPolyline3DElement extends HTMLElement {
    coordinates: Array<google.maps.LatLngLiteral & { altitude?: number }>;
  }
}

export {};
