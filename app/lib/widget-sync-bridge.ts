import { Platform } from 'react-native';

import type { WidgetPayload } from './widget-sync';

const APP_GROUP = 'group.com.joshbernd.habits';
const WIDGET_DATA_KEY = 'widgetData';

let storage: InstanceType<
  typeof import('@bacons/apple-targets').ExtensionStorage
> | null = null;

function getStorage() {
  if (storage) return storage;
  if (Platform.OS !== 'ios') return null;
  const { ExtensionStorage } = require('@bacons/apple-targets');
  storage = new ExtensionStorage(APP_GROUP);
  return storage;
}

export function writeWidgetData(payload: WidgetPayload): void {
  const s = getStorage();
  if (!s) return;
  s.set(WIDGET_DATA_KEY, JSON.stringify(payload));
}

export function reloadWidget(): void {
  if (Platform.OS !== 'ios') return;
  const { ExtensionStorage } = require('@bacons/apple-targets');
  ExtensionStorage.reloadWidget();
}
