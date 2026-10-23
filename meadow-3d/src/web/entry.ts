import {shadowOutfit} from '../shadow-outfit';
if(location.pathname==='/play.html')shadowOutfit();
import {isMobileDevice} from './device';

// Mobile play stays closed until the owner explicitly resumes mobile support.
if (isMobileDevice(navigator)) {
 location.replace('/mobile.html');
} else {
 switch (location.pathname) {
  case '/play.html': await import('../boot'); break;
  case '/characters.html': await import('./characters'); break;
  case '/login.html': await import('./login'); break;
  default: await import('./portal');
 }
}
