// Measured from shipped hero sprite pixels; keep body scale fixed within each facing.
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
