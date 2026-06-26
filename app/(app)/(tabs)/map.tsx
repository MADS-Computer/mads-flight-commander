// Metro resolves MapScreen.native.tsx on iOS/Android and MapScreen.tsx on web.
// @rnmapbox/maps is native-only — this indirection keeps it out of the web bundle.
export { default } from '@/components/map/MapScreen';
