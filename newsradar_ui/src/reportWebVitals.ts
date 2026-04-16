import { onCLS, onLCP, onFCP, onTTFB } from "web-vitals";
import type { Metric } from "web-vitals";

const reportWebVitals = (onPerfEntry?: (entry: Metric) => void) => {
  if (onPerfEntry && typeof onPerfEntry === "function") {
    onCLS(onPerfEntry);
    onLCP(onPerfEntry);
    onFCP(onPerfEntry);
    onTTFB(onPerfEntry);
  }
};

export default reportWebVitals;
