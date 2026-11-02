import EventBus from '../event-bus.js';
import { USER_LOG_LEVEL_WARNING, normalizeUserLogLevel } from './userLogLevels.js';

/**
 * The one way plugins write to the User Log.  `message` is rendered as HTML, so escape
 * anything interpolated into it.  `level` is 'v', 'i' or 'w' (default 'w').
 */
export function emitUserLog(subSystem, message, level = USER_LOG_LEVEL_WARNING) {
  if (!message) {
    return;
  }
  EventBus.trigger('UserLog', {
    subSystem,
    message,
    level: normalizeUserLogLevel(level, USER_LOG_LEVEL_WARNING)
  });
}
