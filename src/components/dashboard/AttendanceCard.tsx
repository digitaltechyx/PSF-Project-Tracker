"use client";

import { TimeTrackingWidget } from './TimeTrackingWidget';

/** Compact alias — dashboard uses full TimeTrackingWidget hero. */
export function AttendanceCard({ store }: { store: any }) {
  return <TimeTrackingWidget store={store} />;
}
