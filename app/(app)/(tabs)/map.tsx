// Metro resolves MapScreen.native.tsx on iOS/Android and MapScreen.tsx on web.
// @rnmapbox/maps is native-only — this indirection keeps it out of the web bundle.
import MapScreen from '@/components/map/MapScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function MapRoute() {
  return (
    <ErrorBoundary fallbackLabel="Map failed to load">
      <MapScreen />
    </ErrorBoundary>
  );
}
