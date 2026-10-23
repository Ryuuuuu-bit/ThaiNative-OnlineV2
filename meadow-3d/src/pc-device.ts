/** Device detection, not viewport size: a small desktop window is still supported. */
export function isMobileDevice(device: {userAgent: string; platform: string; maxTouchPoints: number; userAgentData?: {mobile: boolean}}): boolean {
 return device.userAgentData?.mobile === true
  || /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(device.userAgent)
  || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
}
