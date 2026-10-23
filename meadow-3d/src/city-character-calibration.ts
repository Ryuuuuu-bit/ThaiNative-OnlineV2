// Opaque body pixels: alpha >= 100, at least 3 pixels per scanline to exclude paint specks.
// Calibrated against the shipped WebP variants; keep one scale for the whole animation.
export const CITIZEN_CALIBRATION:Record<string,{bodyPixels:number;feet:number[]}>= {
 "market-0":{"bodyPixels":152,"feet":[151,152,156,150]},
 "market-1":{"bodyPixels":161,"feet":[160,162,164,162]},
 "market-2":{"bodyPixels":160,"feet":[156,161,160,160]},
 "market-3":{"bodyPixels":165,"feet":[165,165,165,166]},
 "market-4":{"bodyPixels":165,"feet":[163,166,165,166]},
 "market-5":{"bodyPixels":162,"feet":[162,163,161,163]},
 "market-6":{"bodyPixels":161,"feet":[160,162,159,162]},
 "market-7":{"bodyPixels":166,"feet":[167,167,168,168]},
 "craft-0":{"bodyPixels":172,"feet":[170,174,171,173]},
 "craft-1":{"bodyPixels":171,"feet":[172,171,171,171]},
 "craft-2":{"bodyPixels":177,"feet":[177,177,180,178]},
 "craft-3":{"bodyPixels":181,"feet":[183,182,181,182]},
 "craft-4":{"bodyPixels":183,"feet":[182,183,182,184]},
 "craft-5":{"bodyPixels":178,"feet":[177,178,178,178]},
 "craft-6":{"bodyPixels":179,"feet":[175,179,178,177]},
 "craft-7":{"bodyPixels":182,"feet":[178,182,181,181]},
 "civic-0":{"bodyPixels":175,"feet":[176,176,177,174]},
 "civic-1":{"bodyPixels":169,"feet":[169,170,169,169]},
 "civic-2":{"bodyPixels":175,"feet":[182,182,183,182]},
 "civic-3":{"bodyPixels":170,"feet":[170,170,168,170]},
 "civic-4":{"bodyPixels":183,"feet":[186,184,185,181]},
 "civic-5":{"bodyPixels":170,"feet":[170,170,170,170]},
 "civic-6":{"bodyPixels":173,"feet":[173,173,174,173]},
 "civic-7":{"bodyPixels":172,"feet":[174,173,174,173]},
 "garden-0":{"bodyPixels":175,"feet":[175,176,176,176]},
 "garden-1":{"bodyPixels":187,"feet":[188,188,188,188]},
 "garden-2":{"bodyPixels":180,"feet":[181,181,181,179]},
 "garden-3":{"bodyPixels":182,"feet":[180,182,181,179]},
 "garden-4":{"bodyPixels":183,"feet":[182,184,184,183]},
 "garden-5":{"bodyPixels":198,"feet":[200,199,198,198]},
 "garden-6":{"bodyPixels":144,"feet":[145,144,145,143]},
 "garden-7":{"bodyPixels":172,"feet":[170,173,170,171]},
 "travel-0":{"bodyPixels":178,"feet":[179,178,179,180]},
 "travel-1":{"bodyPixels":147,"feet":[148,148,146,144]},
 "travel-2":{"bodyPixels":195,"feet":[197,196,192,194]},
 "travel-3":{"bodyPixels":184,"feet":[187,184,187,185]},
 "travel-4":{"bodyPixels":182,"feet":[180,182,179,179]},
 "travel-5":{"bodyPixels":193,"feet":[188,193,192,188]},
 "travel-6":{"bodyPixels":175,"feet":[176,175,174,173]},
 "travel-7":{"bodyPixels":175,"feet":[173,175,175,173]}
};
export const HERO_WALK_CALIBRATION= {
  "SE": {
    "scale": 1.018181818181818,
    "feet": 240.50000000000003
  },
  "SW": {
    "scale": 1.0275229357798166,
    "feet": 239.50000000000003
  },
  "NE": {
    "scale": 1.018181818181818,
    "feet": 239.00000000000006
  },
  "NW": {
    "scale": 1.037037037037037,
    "feet": 239.5000000000001
  },
  "S": {
    "scale": 1.037037037037037,
    "feet": 236.00000000000023
  },
  "E": {
    "scale": 1.0,
    "feet": 241.0000000000001
  },
  "N": {
    "scale": 1.0275229357798166,
    "feet": 239.00000000000023
  },
  "W": {
    "scale": 1.0,
    "feet": 239.5000000000001
  }
} as const;

const HERO_IDLE_CALIBRATION={
  "SE": {
    "scale": 1.0109797297297296,
    "feet": 239.53216374269005
  },
  "SW": {
    "scale": 1.0109797297297296,
    "feet": 239.53216374269005
  },
  "NE": {
    "scale": 1.0201704545454546,
    "feet": 239.53216374269005
  },
  "NW": {
    "scale": 1.0201704545454546,
    "feet": 239.53216374269005
  }
} as const;
const HERO_WALK_FEET={"SE":[244.5,243.0,237.0,231.0,238.5,241.5,238.5,234.0,228.5,242.0,243.5,240.5],"SW":[228.5,230.0,233.0,233.0,227.5,229.0,238.0,238.0,244.0,239.5,230.5,239.5],"NE":[238.5,238.5,240.0,240.0,241.5,243.0,243.0,238.5,233.0,231.5,239.0,239.0],"NW":[242.0,243.5,243.5,245.0,245.5,247.0,247.0,247.0,242.5,239.5,239.5,239.5],"S":[244.5,234.0,240.0,240.0,234.0,232.5,240.0,247.5,236.0,236.0,236.0,236.0],"E":[240.5,234.5,230.0,227.0,236.5,238.0,245.5,242.5,241.0,241.0,241.0,241.0],"N":[237.0,232.5,235.5,241.5,249.0,250.5,250.5,246.0,240.5,239.0,239.0,239.0],"W":[240.5,236.0,231.5,228.5,236.5,239.5,242.5,239.5,239.5,239.5,239.5,239.5]} as const;

/** Keep body scale fixed for each direction; only ground contact follows the walking pose. */
export function heroBodyCalibration(sheet:string,facing:keyof typeof HERO_WALK_CALIBRATION,column:number,row:number){
 if(sheet==='walk')return {...HERO_WALK_CALIBRATION[facing],feet:HERO_WALK_FEET[facing][(row*8+column)%12]};
 if(sheet==='idle'&&facing in HERO_IDLE_CALIBRATION)return HERO_IDLE_CALIBRATION[facing as keyof typeof HERO_IDLE_CALIBRATION];
 return undefined;
}
