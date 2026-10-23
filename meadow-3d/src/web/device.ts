/** Do not use viewport size or touch alone: small windows and touchscreen PCs can still play. */
export function isMobileDevice(device: {userAgent: string; platform: string; maxTouchPoints: number; userAgentData?: {mobile: boolean}}) {
 return device.userAgentData?.mobile === true
  || /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(device.userAgent)
  || (device.maxTouchPoints > 1 && (device.platform === 'MacIntel' || /Macintosh/i.test(device.userAgent)));
}
