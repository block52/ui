/**
 * Table Layout Configuration System
 * 
 * This configuration file centralizes all table and seat positioning logic
 * for different viewport modes and device orientations.
 * 
 * HOW TO ADJUST POSITIONS:
 * 1. Find the viewport mode you want to adjust (mobile-portrait, mobile-landscape, tablet, desktop)
 * 2. Locate the element type (players, vacantPlayers, chips, dealers, etc.)
 * 3. Find the seat number (array index 0 = seat 1, index 1 = seat 2, etc.)
 * 4. Adjust the left/top values (use px for absolute, % for relative positioning)
 * 5. Save and refresh to see changes
 * 
 * Viewport Breakpoints:
 * - Mobile Portrait: width <= 414px, portrait orientation
 * - Mobile Landscape: width <= 926px, landscape orientation  
 * - Tablet: 927px <= width <= 1024px
 * - Desktop: width > 1024px
 */

export interface Position {
  left: string;
  top: string;
  color?: string;
}

export interface ChipPosition {
  left: string;
  bottom: string;
}

export interface ViewportConfig {
  table: {
    scale: number;
    translateX: string;
    translateY: string;
    rotation?: number; // For fixing mobile landscape orientation
  };
  players: {
    four: Position[];
    six: Position[];
    nine: Position[];
  };
  vacantPlayers: {
    four: Position[];
    six: Position[];
    nine: Position[];
  };
  chips: {
    four: ChipPosition[];
    six: ChipPosition[];
    nine: ChipPosition[];
  };
  dealers: {
    four: Position[];
    six: Position[];
    nine: Position[];
  };
  turnAnimations: {
    four: Position[];
    six: Position[];
    nine: Position[];
  };
  winAnimations: {
    four: Position[];
    six: Position[];
    nine: Position[];
  };
}

// Helper function to detect viewport mode
export const getViewportMode = (): "mobile-portrait" | "mobile-landscape" | "tablet" | "desktop" => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width > height;
  
  if (width <= 414 && !isLandscape) {
    return "mobile-portrait";
  } else if (width <= 926 && isLandscape) {
    return "mobile-landscape";
  } else if (width <= 1024) {
    return "tablet";
  } else {
    return "desktop";
  }
};

// Configuration for each viewport mode
export const viewportConfigs: Record<string, ViewportConfig> = {
  /**
   * =====================================================
   * MOBILE PORTRAIT CONFIGURATION
   * For phones in vertical orientation (width <= 414px)
   * =====================================================
   */
  "mobile-portrait": {
    // TABLE POSITION & SCALE
    table: {
      scale: 1,           // Base scale - actual scaling handled by calculateTableZoom()
      translateX: "-50%",   // Center horizontally
      translateY: "-50%",   // Center vertically  
      rotation: 0           // No rotation needed
    },
    
    // PLAYER SEAT POSITIONS (where players sit)
    players: {
      // 4-PLAYER TABLE POSITIONS (cross pattern)
      four: [
        { left: "50%", top: "400px", color: "#4ade80" },    // Seat 1 - Bottom (green)
        { left: "-100px", top: "80px", color: "#f97316" },     // Seat 2 - Left (orange)
        { left: "50%", top: "-140px", color: "#3b82f6" },    // Seat 3 - Top (blue)
        { left: "980px", top: "80px", color: "#ec4899" }      // Seat 4 - Right (pink)
      ],
      
      // 6-PLAYER TABLE POSITIONS
      six: [
        { left: "40%", top: "100%" },    // Seat 1 - Bottom left
        { left: "17%", top: "32%" },     // Seat 2 - Left side
        { left: "40%", top: "-35%" },    // Seat 3 - Top left
        { left: "60%", top: "-35%" },    // Seat 4 - Top right
        { left: "83%", top: "32%" },     // Seat 5 - Right side
        { left: "60%", top: "100%" }     // Seat 6 - Bottom right
      ],
      
      // 9-PLAYER TABLE POSITIONS
      nine: [
        { left: "450px", top: "390px", color: "#4ade80" },   // Seat 1 - Bottom center
        { left: "155px", top: "374px", color: "#f97316" },   // Seat 2 - Bottom left
        { left: "-100px", top: "230px", color: "#ef4444" },  // Seat 3 - Left side
        { left: "-55px", top: "-20px", color: "#3b82f6" },   // Seat 4 - Top left corner
        { left: "270px", top: "-100px", color: "#8b5cf6" },  // Seat 5 - Top left
        { left: "600px", top: "-100px", color: "#212529" },  // Seat 6 - Top right
        { left: "965px", top: "-20px", color: "#FFD700" },   // Seat 7 - Top right corner
        { left: "999px", top: "230px", color: "#ec4899" },   // Seat 8 - Right side
        { left: "745px", top: "374px", color: "#6b7280" }    // Seat 9 - Bottom right
      ]
    },
    
    // VACANT SEAT POSITIONS (empty seat indicators)
    vacantPlayers: {
      // 4-PLAYER VACANT SEATS
      four: [
        { left: "400px", top: "400px" },    // Empty Seat 1
        { left: "-140px", top: "32%" },     // Empty Seat 2
        { left: "550px", top: "00px" },    // Empty Seat 3
        { left: "90%", top: "32%" }      // Empty Seat 4
      ],
      
      // 6-PLAYER VACANT SEATS
      six: [
        { left: "40%", top: "100%" },    // Empty Seat 1
        { left: "17%", top: "32%" },     // Empty Seat 2
        { left: "40%", top: "-35%" },    // Empty Seat 3
        { left: "60%", top: "-35%" },    // Empty Seat 4
        { left: "83%", top: "32%" },     // Empty Seat 5
        { left: "60%", top: "100%" }     // Empty Seat 6
      ],
      
      // 9-PLAYER VACANT SEATS
      nine: [
        { left: "414px", top: "399px" },   // Empty Seat 1
        { left: "130px", top: "374px" },   // Empty Seat 2
        { left: "-110px", top: "220px" },  // Empty Seat 3
        { left: "-55px", top: "-30px" },   // Empty Seat 4
        { left: "240px", top: "-110px" },  // Empty Seat 5
        { left: "580px", top: "-110px" },  // Empty Seat 6
        { left: "880px", top: "-30px" },   // Empty Seat 7
        { left: "929px", top: "220px" },   // Empty Seat 8
        { left: "700px", top: "374px" }    // Empty Seat 9
      ]
    },
    
    // CHIP POSITIONS (betting chips on table)
    chips: {
      // 4-PLAYER CHIP POSITIONS
      four: [
        { left: "50%", bottom: "10px" },  // Chips for Seat 1
        { left: "50px", bottom: "150px" },  // Chips for Seat 2
        { left: "200px", bottom: "240px" },  // Chips for Seat 3
        { left: "750px", bottom: "150px" }   // Chips for Seat 4
      ],
      
      // 6-PLAYER CHIP POSITIONS
      six: [
        { left: "40%", bottom: "10px" },    // Chips for Seat 1
        { left: "17%", bottom: "50%" },     // Chips for Seat 2
        { left: "40%", bottom: "90%" },     // Chips for Seat 3
        { left: "60%", bottom: "90%" },     // Chips for Seat 4
        { left: "83%", bottom: "50%" },     // Chips for Seat 5
        { left: "60%", bottom: "10px" }     // Chips for Seat 6
      ],
      
      // 9-PLAYER CHIP POSITIONS
      nine: [
        { bottom: "10px", left: "430px" },   // Chips for Seat 1
        { bottom: "12px", left: "130px" },   // Chips for Seat 2
        { bottom: "110px", left: "-20px" },  // Chips for Seat 3
        { bottom: "255px", left: "39px" },   // Chips for Seat 4
        { bottom: "310px", left: "245px" },  // Chips for Seat 5
        { bottom: "310px", left: "575px" },  // Chips for Seat 6
        { bottom: "255px", left: "810px" },  // Chips for Seat 7
        { bottom: "110px", left: "873px" },  // Chips for Seat 8
        { bottom: "12px", left: "720px" }    // Chips for Seat 9
      ]
    },
    
    // DEALER BUTTON POSITIONS
    dealers: {
      // 4-PLAYER DEALER POSITIONS
      four: [
        { left: "420px", top: "360px" },  // Dealer at Seat 1
        { left: "-50px", top: "175px" },   // Dealer at Seat 2
        { left: "420px", top: "-70px" },   // Dealer at Seat 3
        { left: "920px", top: "175px" }    // Dealer at Seat 4
      ],
      
      // 6-PLAYER DEALER POSITIONS
      six: [
        { left: "40%", top: "100%" },    // Dealer at Seat 1
        { left: "17%", top: "32%" },     // Dealer at Seat 2
        { left: "40%", top: "-35%" },    // Dealer at Seat 3
        { left: "60%", top: "-35%" },    // Dealer at Seat 4
        { left: "83%", top: "32%" },     // Dealer at Seat 5
        { left: "60%", top: "100%" }     // Dealer at Seat 6
      ],
      
      // 9-PLAYER DEALER POSITIONS
      nine: [
        { left: "320px", top: "350px" },   // Dealer at Seat 1
        { left: "25px", top: "335px" },    // Dealer at Seat 2
        { left: "-215px", top: "265px" },  // Dealer at Seat 3
        { left: "-169px", top: "28px" },   // Dealer at Seat 4
        { left: "150px", top: "-50px" },   // Dealer at Seat 5
        { left: "285px", top: "-50px" },   // Dealer at Seat 6
        { left: "635px", top: "30px" },    // Dealer at Seat 7
        { left: "680px", top: "265px" },   // Dealer at Seat 8
        { left: "445px", top: "331px" }    // Dealer at Seat 9
      ]
    },
    
    // TURN INDICATOR ANIMATIONS (shows whose turn)
    turnAnimations: {
      // 4-PLAYER TURN INDICATORS
      four: [
        { left: "450px", top: "399px" },   // Turn indicator Seat 1
        { left: "-110px", top: "175px" },  // Turn indicator Seat 2
        { left: "450px", top: "-110px" },  // Turn indicator Seat 3
        { left: "999px", top: "175px" }    // Turn indicator Seat 4
      ],
      
      // 6-PLAYER TURN INDICATORS
      six: [
        { left: "40%", top: "100%" },    // Turn indicator at Seat 1
        { left: "17%", top: "32%" },     // Turn indicator at Seat 2
        { left: "40%", top: "-35%" },    // Turn indicator at Seat 3
        { left: "60%", top: "-35%" },    // Turn indicator at Seat 4
        { left: "83%", top: "32%" },     // Turn indicator at Seat 5
        { left: "60%", top: "100%" }     // Turn indicator at Seat 6
      ],
      
      // 9-PLAYER TURN INDICATORS
      nine: [
        { left: "450px", top: "470px" },   // Turn indicator at Seat 1
        { left: "155px", top: "460px" },   // Turn indicator at Seat 2
        { left: "-104px", top: "320px" },  // Turn indicator at Seat 3
        { left: "-59px", top: "69px" },    // Turn indicator at Seat 4
        { left: "267px", top: "-10px" },   // Turn indicator at Seat 5
        { left: "600px", top: "-10px" },   // Turn indicator at Seat 6
        { left: "960px", top: "69px" },    // Turn indicator at Seat 7
        { left: "999px", top: "320px" },   // Turn indicator at Seat 8
        { left: "740px", top: "460px" }    // Turn indicator at Seat 9
      ]
    },
    
    // WIN CELEBRATION ANIMATIONS
    winAnimations: {
      // 4-PLAYER WIN ANIMATIONS
      four: [
        { left: "450px", top: "399px" },   // Win animation Seat 1
        { left: "-110px", top: "175px" },  // Win animation Seat 2
        { left: "450px", top: "-110px" },  // Win animation Seat 3
        { left: "999px", top: "175px" }    // Win animation Seat 4
      ],
      
      // 6-PLAYER WIN ANIMATIONS
      six: [
        { left: "40%", top: "100%" },    // Win animation at Seat 1
        { left: "17%", top: "32%" },     // Win animation at Seat 2
        { left: "40%", top: "-35%" },    // Win animation at Seat 3
        { left: "60%", top: "-35%" },    // Win animation at Seat 4
        { left: "83%", top: "32%" },     // Win animation at Seat 5
        { left: "60%", top: "100%" }     // Win animation at Seat 6
      ],
      
      // 9-PLAYER WIN ANIMATIONS
      nine: [
        { left: "450px", top: "470px" },   // Win animation at Seat 1
        { left: "155px", top: "460px" },   // Win animation at Seat 2
        { left: "-104px", top: "320px" },  // Win animation at Seat 3
        { left: "-59px", top: "69px" },    // Win animation at Seat 4
        { left: "267px", top: "-10px" },   // Win animation at Seat 5
        { left: "600px", top: "-10px" },   // Win animation at Seat 6
        { left: "960px", top: "69px" },    // Win animation at Seat 7
        { left: "999px", top: "320px" },   // Win animation at Seat 8
        { left: "740px", top: "460px" }    // Win animation at Seat 9
      ]
    }
  },
  
  /**
   * =====================================================
   * MOBILE LANDSCAPE CONFIGURATION
   * For phones in horizontal orientation (width <= 926px)
   * =====================================================
   */
  "mobile-landscape": {
    // TABLE POSITION & SCALE
    table: {
      scale: 1,           // Base scale - actual scaling handled by calculateTableZoom()
      translateX: "-50%",   // Center horizontally
      translateY: "20%",   // Moved up to account for removed header
      rotation: 180         // Needs to be 180 for proper orientation
    },
    
    // PLAYER SEAT POSITIONS
    players: {
      // 4-PLAYER TABLE POSITIONS
      four: [
        { left: "450px", top: "399px", color: "#4ade80" },   // Seat 1 - Bottom (green)
        { left: "-110px", top: "175px", color: "#f97316" },  // Seat 2 - Left (orange)
        { left: "450px", top: "-110px", color: "#3b82f6" },  // Seat 3 - Top (blue)
        { left: "999px", top: "175px", color: "#ec4899" }    // Seat 4 - Right (pink)
      ],
      
      // 6-PLAYER TABLE POSITIONS
      six: [
        { left: "40%", top: "100%" },    // Seat 1 - Bottom left
        { left: "17%", top: "32%" },     // Seat 2 - Left side
        { left: "40%", top: "-35%" },    // Seat 3 - Top left
        { left: "60%", top: "-35%" },    // Seat 4 - Top right
        { left: "83%", top: "32%" },     // Seat 5 - Right side
        { left: "60%", top: "100%" }     // Seat 6 - Bottom right
      ],
      
      // 9-PLAYER TABLE POSITIONS
      nine: [
        { left: "450px", top: "390px", color: "#4ade80" },   // Seat 1 - Bottom center
        { left: "155px", top: "374px", color: "#f97316" },   // Seat 2 - Bottom left
        { left: "-100px", top: "230px", color: "#ef4444" },  // Seat 3 - Left side
        { left: "-55px", top: "-20px", color: "#3b82f6" },   // Seat 4 - Top left corner
        { left: "270px", top: "-100px", color: "#8b5cf6" },  // Seat 5 - Top left
        { left: "600px", top: "-100px", color: "#212529" },  // Seat 6 - Top right
        { left: "965px", top: "-20px", color: "#FFD700" },   // Seat 7 - Top right corner
        { left: "999px", top: "230px", color: "#ec4899" },   // Seat 8 - Right side
        { left: "745px", top: "374px", color: "#6b7280" }    // Seat 9 - Bottom right
      ]
    },
    
    // VACANT SEAT POSITIONS
    vacantPlayers: {
      // 4-PLAYER VACANT SEATS
      four: [
        { left: "450px", top: "399px" },   // Seat 1 - Bottom
        { left: "-110px", top: "175px" },  // Seat 2 - Left
        { left: "450px", top: "-110px" },  // Seat 3 - Top
        { left: "999px", top: "175px" }    // Seat 4 - Right
      ],
      
      // 6-PLAYER VACANT SEATS
      six: [
        { left: "40%", top: "100%" },    // Empty Seat 1
        { left: "17%", top: "32%" },     // Empty Seat 2
        { left: "40%", top: "-35%" },    // Empty Seat 3
        { left: "60%", top: "-35%" },    // Empty Seat 4
        { left: "83%", top: "32%" },     // Empty Seat 5
        { left: "60%", top: "100%" }     // Empty Seat 6
      ],
      
      // 9-PLAYER VACANT SEATS
      nine: [
        { left: "414px", top: "399px" },   // Empty Seat 1
        { left: "130px", top: "374px" },   // Empty Seat 2
        { left: "-110px", top: "220px" },  // Empty Seat 3
        { left: "-55px", top: "-30px" },   // Empty Seat 4
        { left: "240px", top: "-110px" },  // Empty Seat 5
        { left: "580px", top: "-110px" },  // Empty Seat 6
        { left: "880px", top: "-30px" },   // Empty Seat 7
        { left: "929px", top: "220px" },   // Empty Seat 8
        { left: "700px", top: "374px" }    // Empty Seat 9
      ]
    },
    
    // CHIP POSITIONS
    chips: {
      // 4-PLAYER CHIP POSITIONS
      four: [
        { left: "500px", bottom: "20px" },  // Chips for Seat 1
        { left: "30px", bottom: "130px" },  // Chips for Seat 2
        { left: "240px", bottom: "300px" },  // Chips for Seat 3
        { left: "750px", bottom: "130px" }   // Chips for Seat 4
      ],
      
      // 6-PLAYER CHIP POSITIONS
      six: [
        { left: "40%", bottom: "10px" },    // Chips for Seat 1
        { left: "17%", bottom: "50%" },     // Chips for Seat 2
        { left: "40%", bottom: "90%" },     // Chips for Seat 3
        { left: "60%", bottom: "90%" },     // Chips for Seat 4
        { left: "83%", bottom: "50%" },     // Chips for Seat 5
        { left: "60%", bottom: "10px" }     // Chips for Seat 6
      ],
      
      // 9-PLAYER CHIP POSITIONS
      nine: [
        { bottom: "10px", left: "430px" },   // Chips for Seat 1
        { bottom: "12px", left: "130px" },   // Chips for Seat 2
        { bottom: "110px", left: "-20px" },  // Chips for Seat 3
        { bottom: "255px", left: "39px" },   // Chips for Seat 4
        { bottom: "310px", left: "245px" },  // Chips for Seat 5
        { bottom: "310px", left: "575px" },  // Chips for Seat 6
        { bottom: "255px", left: "810px" },  // Chips for Seat 7
        { bottom: "110px", left: "873px" },  // Chips for Seat 8
        { bottom: "12px", left: "720px" }    // Chips for Seat 9
      ]
    },
    
    // DEALER BUTTON POSITIONS
    dealers: {
      // 4-PLAYER DEALER POSITIONS
      four: [
        { left: "420px", top: "360px" },  // Dealer at Seat 1
        { left: "-50px", top: "175px" },   // Dealer at Seat 2
        { left: "420px", top: "-70px" },   // Dealer at Seat 3
        { left: "920px", top: "175px" }    // Dealer at Seat 4
      ],
      
      // 6-PLAYER DEALER POSITIONS
      six: [
        { left: "40%", top: "100%" },    // Dealer at Seat 1
        { left: "17%", top: "32%" },     // Dealer at Seat 2
        { left: "40%", top: "-35%" },    // Dealer at Seat 3
        { left: "60%", top: "-35%" },    // Dealer at Seat 4
        { left: "83%", top: "32%" },     // Dealer at Seat 5
        { left: "60%", top: "100%" }     // Dealer at Seat 6
      ],
      
      // 9-PLAYER DEALER POSITIONS
      nine: [
        { left: "320px", top: "350px" },   // Dealer at Seat 1
        { left: "25px", top: "335px" },    // Dealer at Seat 2
        { left: "-215px", top: "265px" },  // Dealer at Seat 3
        { left: "-169px", top: "28px" },   // Dealer at Seat 4
        { left: "150px", top: "-50px" },   // Dealer at Seat 5
        { left: "285px", top: "-50px" },   // Dealer at Seat 6
        { left: "635px", top: "30px" },    // Dealer at Seat 7
        { left: "680px", top: "265px" },   // Dealer at Seat 8
        { left: "445px", top: "331px" }    // Dealer at Seat 9
      ]
    },
    
    // TURN INDICATOR ANIMATIONS
    turnAnimations: {
      // 4-PLAYER TURN INDICATORS
      four: [
        { left: "450px", top: "500px" },   // Turn indicator Seat 1
        { left: "-110px", top: "270px" },  // Turn indicator Seat 2
        { left: "450px", top: "-20px" },  // Turn indicator Seat 3
        { left: "999px", top: "175px" }    // Turn indicator Seat 4
      ],
      
      // 6-PLAYER TURN INDICATORS
      six: [
        { left: "40%", top: "100%" },    // Turn indicator at Seat 1
        { left: "17%", top: "32%" },     // Turn indicator at Seat 2
        { left: "40%", top: "-35%" },    // Turn indicator at Seat 3
        { left: "60%", top: "-35%" },    // Turn indicator at Seat 4
        { left: "83%", top: "32%" },     // Turn indicator at Seat 5
        { left: "60%", top: "100%" }     // Turn indicator at Seat 6
      ],
      
      // 9-PLAYER TURN INDICATORS
      nine: [
        { left: "450px", top: "470px" },   // Turn indicator at Seat 1
        { left: "155px", top: "460px" },   // Turn indicator at Seat 2
        { left: "-104px", top: "320px" },  // Turn indicator at Seat 3
        { left: "-59px", top: "69px" },    // Turn indicator at Seat 4
        { left: "267px", top: "-10px" },   // Turn indicator at Seat 5
        { left: "600px", top: "-10px" },   // Turn indicator at Seat 6
        { left: "960px", top: "69px" },    // Turn indicator at Seat 7
        { left: "999px", top: "320px" },   // Turn indicator at Seat 8
        { left: "740px", top: "460px" }    // Turn indicator at Seat 9
      ]
    },
    
    // WIN CELEBRATION ANIMATIONS
    winAnimations: {
      // 4-PLAYER WIN ANIMATIONS
      four: [
        { left: "450px", top: "399px" },   // Win animation Seat 1
        { left: "-110px", top: "175px" },  // Win animation Seat 2
        { left: "450px", top: "-110px" },  // Win animation Seat 3
        { left: "999px", top: "175px" }    // Win animation Seat 4
      ],
      
      // 6-PLAYER WIN ANIMATIONS
      six: [
        { left: "40%", top: "100%" },    // Win animation at Seat 1
        { left: "17%", top: "32%" },     // Win animation at Seat 2
        { left: "40%", top: "-35%" },    // Win animation at Seat 3
        { left: "60%", top: "-35%" },    // Win animation at Seat 4
        { left: "83%", top: "32%" },     // Win animation at Seat 5
        { left: "60%", top: "100%" }     // Win animation at Seat 6
      ],
      
      // 9-PLAYER WIN ANIMATIONS
      nine: [
        { left: "450px", top: "470px" },   // Win animation at Seat 1
        { left: "155px", top: "460px" },   // Win animation at Seat 2
        { left: "-104px", top: "320px" },  // Win animation at Seat 3
        { left: "-59px", top: "69px" },    // Win animation at Seat 4
        { left: "267px", top: "-10px" },   // Win animation at Seat 5
        { left: "600px", top: "-10px" },   // Win animation at Seat 6
        { left: "960px", top: "69px" },    // Win animation at Seat 7
        { left: "999px", top: "320px" },   // Win animation at Seat 8
        { left: "740px", top: "460px" }    // Win animation at Seat 9
      ]
    }
  },
  
  /**
   * =====================================================
   * TABLET CONFIGURATION
   * For tablets and medium screens (927px - 1024px)
   * =====================================================
   */
  "tablet": {
    // TABLE POSITION & SCALE
    table: {
      scale: 1,           // Base scale - actual scaling handled by calculateTableZoom()
      translateX: "-50%",   // Center horizontally
      translateY: "-50%",   // Center vertically
      rotation: 0           // No rotation needed
    },
    
    // PLAYER SEAT POSITIONS
    players: {
      // 4-PLAYER TABLE POSITIONS
      four: [
        { left: "450px", top: "399px", color: "#4ade80" },   // Seat 1 - Bottom (green)
        { left: "-110px", top: "175px", color: "#f97316" },  // Seat 2 - Left (orange)
        { left: "450px", top: "-110px", color: "#3b82f6" },  // Seat 3 - Top (blue)
        { left: "999px", top: "175px", color: "#ec4899" }    // Seat 4 - Right (pink)
      ],
      
      // 6-PLAYER TABLE POSITIONS
      six: [
        { left: "40%", top: "100%" },    // Seat 1 - Bottom left
        { left: "17%", top: "32%" },     // Seat 2 - Left side
        { left: "40%", top: "-35%" },    // Seat 3 - Top left
        { left: "60%", top: "-35%" },    // Seat 4 - Top right
        { left: "83%", top: "32%" },     // Seat 5 - Right side
        { left: "60%", top: "100%" }     // Seat 6 - Bottom right
      ],
      
      // 9-PLAYER TABLE POSITIONS
      nine: [
        { left: "450px", top: "390px", color: "#4ade80" },   // Seat 1 - Bottom center
        { left: "155px", top: "374px", color: "#f97316" },   // Seat 2 - Bottom left
        { left: "-100px", top: "230px", color: "#ef4444" },  // Seat 3 - Left side
        { left: "-55px", top: "-20px", color: "#3b82f6" },   // Seat 4 - Top left corner
        { left: "270px", top: "-100px", color: "#8b5cf6" },  // Seat 5 - Top left
        { left: "600px", top: "-100px", color: "#212529" },  // Seat 6 - Top right
        { left: "965px", top: "-20px", color: "#FFD700" },   // Seat 7 - Top right corner
        { left: "999px", top: "230px", color: "#ec4899" },   // Seat 8 - Right side
        { left: "745px", top: "374px", color: "#6b7280" }    // Seat 9 - Bottom right
      ]
    },
    
    // VACANT SEAT POSITIONS
    vacantPlayers: {
      // 4-PLAYER VACANT SEATS
      four: [
        { left: "450px", top: "399px" },   // Seat 1 - Bottom
        { left: "-110px", top: "175px" },  // Seat 2 - Left
        { left: "450px", top: "-110px" },  // Seat 3 - Top
        { left: "999px", top: "175px" }    // Seat 4 - Right
      ],
      
      // 6-PLAYER VACANT SEATS
      six: [
        { left: "40%", top: "100%" },    // Empty Seat 1
        { left: "17%", top: "32%" },     // Empty Seat 2
        { left: "40%", top: "-35%" },    // Empty Seat 3
        { left: "60%", top: "-35%" },    // Empty Seat 4
        { left: "83%", top: "32%" },     // Empty Seat 5
        { left: "60%", top: "100%" }     // Empty Seat 6
      ],
      
      // 9-PLAYER VACANT SEATS
      nine: [
        { left: "414px", top: "399px" },   // Empty Seat 1
        { left: "130px", top: "374px" },   // Empty Seat 2
        { left: "-110px", top: "220px" },  // Empty Seat 3
        { left: "-55px", top: "-30px" },   // Empty Seat 4
        { left: "240px", top: "-110px" },  // Empty Seat 5
        { left: "580px", top: "-110px" },  // Empty Seat 6
        { left: "880px", top: "-30px" },   // Empty Seat 7
        { left: "929px", top: "220px" },   // Empty Seat 8
        { left: "700px", top: "374px" }    // Empty Seat 9
      ]
    },
    
    // CHIP POSITIONS
    chips: {
      // 4-PLAYER CHIP POSITIONS
      four: [
        { left: "450px", bottom: "260px" },  // Chips for Seat 1
        { left: "200px", bottom: "350px" },  // Chips for Seat 2
        { left: "450px", bottom: "440px" },  // Chips for Seat 3
        { left: "700px", bottom: "350px" }   // Chips for Seat 4
      ],
      
      // 6-PLAYER CHIP POSITIONS
      six: [
        { left: "40%", bottom: "10px" },    // Chips for Seat 1
        { left: "17%", bottom: "50%" },     // Chips for Seat 2
        { left: "40%", bottom: "90%" },     // Chips for Seat 3
        { left: "60%", bottom: "90%" },     // Chips for Seat 4
        { left: "83%", bottom: "50%" },     // Chips for Seat 5
        { left: "60%", bottom: "10px" }     // Chips for Seat 6
      ],
      
      // 9-PLAYER CHIP POSITIONS
      nine: [
        { bottom: "10px", left: "430px" },   // Chips for Seat 1
        { bottom: "12px", left: "130px" },   // Chips for Seat 2
        { bottom: "110px", left: "-20px" },  // Chips for Seat 3
        { bottom: "255px", left: "39px" },   // Chips for Seat 4
        { bottom: "310px", left: "245px" },  // Chips for Seat 5
        { bottom: "310px", left: "575px" },  // Chips for Seat 6
        { bottom: "255px", left: "810px" },  // Chips for Seat 7
        { bottom: "110px", left: "873px" },  // Chips for Seat 8
        { bottom: "12px", left: "720px" }    // Chips for Seat 9
      ]
    },
    
    // DEALER BUTTON POSITIONS
    dealers: {
      // 4-PLAYER DEALER POSITIONS
      four: [
        { left: "420px", top: "360px" },  // Dealer at Seat 1
        { left: "-50px", top: "175px" },   // Dealer at Seat 2
        { left: "420px", top: "-70px" },   // Dealer at Seat 3
        { left: "920px", top: "175px" }    // Dealer at Seat 4
      ],
      
      // 6-PLAYER DEALER POSITIONS
      six: [
        { left: "40%", top: "100%" },    // Dealer at Seat 1
        { left: "17%", top: "32%" },     // Dealer at Seat 2
        { left: "40%", top: "-35%" },    // Dealer at Seat 3
        { left: "60%", top: "-35%" },    // Dealer at Seat 4
        { left: "83%", top: "32%" },     // Dealer at Seat 5
        { left: "60%", top: "100%" }     // Dealer at Seat 6
      ],
      
      // 9-PLAYER DEALER POSITIONS
      nine: [
        { left: "320px", top: "350px" },   // Dealer at Seat 1
        { left: "25px", top: "335px" },    // Dealer at Seat 2
        { left: "-215px", top: "265px" },  // Dealer at Seat 3
        { left: "-169px", top: "28px" },   // Dealer at Seat 4
        { left: "150px", top: "-50px" },   // Dealer at Seat 5
        { left: "285px", top: "-50px" },   // Dealer at Seat 6
        { left: "635px", top: "30px" },    // Dealer at Seat 7
        { left: "680px", top: "265px" },   // Dealer at Seat 8
        { left: "445px", top: "331px" }    // Dealer at Seat 9
      ]
    },
    
    // TURN INDICATOR ANIMATIONS
    turnAnimations: {
      // 4-PLAYER TURN INDICATORS
      four: [
        { left: "450px", top: "399px" },   // Turn indicator Seat 1
        { left: "-110px", top: "175px" },  // Turn indicator Seat 2
        { left: "450px", top: "-110px" },  // Turn indicator Seat 3
        { left: "999px", top: "175px" }    // Turn indicator Seat 4
      ],
      
      // 6-PLAYER TURN INDICATORS
      six: [
        { left: "40%", top: "100%" },    // Turn indicator at Seat 1
        { left: "17%", top: "32%" },     // Turn indicator at Seat 2
        { left: "40%", top: "-35%" },    // Turn indicator at Seat 3
        { left: "60%", top: "-35%" },    // Turn indicator at Seat 4
        { left: "83%", top: "32%" },     // Turn indicator at Seat 5
        { left: "60%", top: "100%" }     // Turn indicator at Seat 6
      ],
      
      // 9-PLAYER TURN INDICATORS
      nine: [
        { left: "450px", top: "470px" },   // Turn indicator at Seat 1
        { left: "155px", top: "460px" },   // Turn indicator at Seat 2
        { left: "-104px", top: "320px" },  // Turn indicator at Seat 3
        { left: "-59px", top: "69px" },    // Turn indicator at Seat 4
        { left: "267px", top: "-10px" },   // Turn indicator at Seat 5
        { left: "600px", top: "-10px" },   // Turn indicator at Seat 6
        { left: "960px", top: "69px" },    // Turn indicator at Seat 7
        { left: "999px", top: "320px" },   // Turn indicator at Seat 8
        { left: "740px", top: "460px" }    // Turn indicator at Seat 9
      ]
    },
    
    // WIN CELEBRATION ANIMATIONS
    winAnimations: {
      // 4-PLAYER WIN ANIMATIONS
      four: [
        { left: "450px", top: "399px" },   // Win animation Seat 1
        { left: "-110px", top: "175px" },  // Win animation Seat 2
        { left: "450px", top: "-110px" },  // Win animation Seat 3
        { left: "999px", top: "175px" }    // Win animation Seat 4
      ],
      
      // 6-PLAYER WIN ANIMATIONS
      six: [
        { left: "40%", top: "100%" },    // Win animation at Seat 1
        { left: "17%", top: "32%" },     // Win animation at Seat 2
        { left: "40%", top: "-35%" },    // Win animation at Seat 3
        { left: "60%", top: "-35%" },    // Win animation at Seat 4
        { left: "83%", top: "32%" },     // Win animation at Seat 5
        { left: "60%", top: "100%" }     // Win animation at Seat 6
      ],
      
      // 9-PLAYER WIN ANIMATIONS
      nine: [
        { left: "450px", top: "470px" },   // Win animation at Seat 1
        { left: "155px", top: "460px" },   // Win animation at Seat 2
        { left: "-104px", top: "320px" },  // Win animation at Seat 3
        { left: "-59px", top: "69px" },    // Win animation at Seat 4
        { left: "267px", top: "-10px" },   // Win animation at Seat 5
        { left: "600px", top: "-10px" },   // Win animation at Seat 6
        { left: "960px", top: "69px" },    // Win animation at Seat 7
        { left: "999px", top: "320px" },   // Win animation at Seat 8
        { left: "740px", top: "460px" }    // Win animation at Seat 9
      ]
    }
  },
  
  /**
   * =====================================================
   * DESKTOP CONFIGURATION
   * For large screens (width > 1024px)
   * =====================================================
   */
  "desktop": {
    // TABLE POSITION & SCALE
    table: {
      scale: 1,           // Base scale - actual scaling handled by calculateTableZoom()
      translateX: "-50%",   // Center horizontally
      translateY: "-30%",   // Moved down to prevent top cards cutoff (adjust -20% to -40% as needed)
      rotation: 0           // No rotation needed
    },
    
    // PLAYER SEAT POSITIONS
    players: {
      // 4-PLAYER TABLE POSITIONS
      four: [
        { left: "450px", top: "399px", color: "#4ade80" },   // Seat 1 - Bottom (green)
        { left: "-110px", top: "160px", color: "#f97316" },  // Seat 2 - Left (orange)
        { left: "450px", top: "-110px", color: "#3b82f6" },  // Seat 3 - Top (blue)
        { left: "999px", top: "160px", color: "#ec4899" }    // Seat 4 - Right (pink)
      ],
      
      // 6-PLAYER TABLE POSITIONS
      six: [
        { left: "40%", top: "100%" },    // Seat 1 - Bottom left
        { left: "17%", top: "32%" },     // Seat 2 - Left side
        { left: "40%", top: "-35%" },    // Seat 3 - Top left
        { left: "60%", top: "-35%" },    // Seat 4 - Top right
        { left: "83%", top: "32%" },     // Seat 5 - Right side
        { left: "60%", top: "100%" }     // Seat 6 - Bottom right
      ],
      
      // 9-PLAYER TABLE POSITIONS
      nine: [
        { left: "450px", top: "390px", color: "#4ade80" },   // Seat 1 - Bottom center
        { left: "155px", top: "374px", color: "#f97316" },   // Seat 2 - Bottom left
        { left: "-100px", top: "230px", color: "#ef4444" },  // Seat 3 - Left side
        { left: "-55px", top: "-20px", color: "#3b82f6" },   // Seat 4 - Top left corner
        { left: "270px", top: "-100px", color: "#8b5cf6" },  // Seat 5 - Top left
        { left: "600px", top: "-100px", color: "#212529" },  // Seat 6 - Top right
        { left: "965px", top: "-20px", color: "#FFD700" },   // Seat 7 - Top right corner
        { left: "999px", top: "230px", color: "#ec4899" },   // Seat 8 - Right side
        { left: "745px", top: "374px", color: "#6b7280" }    // Seat 9 - Bottom right
      ]
    },
    
    // VACANT SEAT POSITIONS
    vacantPlayers: {
      // 4-PLAYER VACANT SEATS
      four: [
        { left: "450px", top: "399px" },   // Seat 1 - Bottom
        { left: "-110px", top: "175px" },  // Seat 2 - Left
        { left: "450px", top: "-110px" },  // Seat 3 - Top
        { left: "999px", top: "175px" }    // Seat 4 - Right
      ],
      
      // 6-PLAYER VACANT SEATS
      six: [
        { left: "40%", top: "100%" },    // Empty Seat 1
        { left: "17%", top: "32%" },     // Empty Seat 2
        { left: "40%", top: "-35%" },    // Empty Seat 3
        { left: "60%", top: "-35%" },    // Empty Seat 4
        { left: "83%", top: "32%" },     // Empty Seat 5
        { left: "60%", top: "100%" }     // Empty Seat 6
      ],
      
      // 9-PLAYER VACANT SEATS
      nine: [
        { left: "414px", top: "399px" },   // Empty Seat 1
        { left: "130px", top: "374px" },   // Empty Seat 2
        { left: "-110px", top: "220px" },  // Empty Seat 3
        { left: "-55px", top: "-30px" },   // Empty Seat 4
        { left: "240px", top: "-110px" },  // Empty Seat 5
        { left: "580px", top: "-110px" },  // Empty Seat 6
        { left: "880px", top: "-30px" },   // Empty Seat 7
        { left: "929px", top: "220px" },   // Empty Seat 8
        { left: "700px", top: "374px" }    // Empty Seat 9
      ]
    },
    
    // CHIP POSITIONS
    chips: {
      // 4-PLAYER CHIP POSITIONS
      four: [
        { left: "420px", bottom: "20px" },  // Chips for Seat 1
        { left: "30px", bottom: "150px" },  // Chips for Seat 2
        { left: "220px", bottom: "300px" },  // Chips for Seat 3
        { left: "800px", bottom: "150px" }   // Chips for Seat 4
      ],
      
      // 6-PLAYER CHIP POSITIONS
      six: [
        { left: "40%", bottom: "10px" },    // Chips for Seat 1
        { left: "17%", bottom: "50%" },     // Chips for Seat 2
        { left: "40%", bottom: "90%" },     // Chips for Seat 3
        { left: "60%", bottom: "90%" },     // Chips for Seat 4
        { left: "83%", bottom: "50%" },     // Chips for Seat 5
        { left: "60%", bottom: "10px" }     // Chips for Seat 6
      ],
      
      // 9-PLAYER CHIP POSITIONS
      nine: [
        { bottom: "10px", left: "430px" },   // Chips for Seat 1
        { bottom: "12px", left: "130px" },   // Chips for Seat 2
        { bottom: "110px", left: "-20px" },  // Chips for Seat 3
        { bottom: "255px", left: "39px" },   // Chips for Seat 4
        { bottom: "310px", left: "245px" },  // Chips for Seat 5
        { bottom: "310px", left: "575px" },  // Chips for Seat 6
        { bottom: "255px", left: "810px" },  // Chips for Seat 7
        { bottom: "110px", left: "873px" },  // Chips for Seat 8
        { bottom: "12px", left: "720px" }    // Chips for Seat 9
      ]
    },
    
    // DEALER BUTTON POSITIONS
    dealers: {
      // 4-PLAYER DEALER POSITIONS
      four: [
        { left: "420px", top: "360px" },  // Dealer at Seat 1
        { left: "-50px", top: "175px" },   // Dealer at Seat 2
        { left: "420px", top: "-70px" },   // Dealer at Seat 3
        { left: "920px", top: "175px" }    // Dealer at Seat 4
      ],
      
      // 6-PLAYER DEALER POSITIONS
      six: [
        { left: "40%", top: "100%" },    // Dealer at Seat 1
        { left: "17%", top: "32%" },     // Dealer at Seat 2
        { left: "40%", top: "-35%" },    // Dealer at Seat 3
        { left: "60%", top: "-35%" },    // Dealer at Seat 4
        { left: "83%", top: "32%" },     // Dealer at Seat 5
        { left: "60%", top: "100%" }     // Dealer at Seat 6
      ],
      
      // 9-PLAYER DEALER POSITIONS
      nine: [
        { left: "320px", top: "350px" },   // Dealer at Seat 1
        { left: "25px", top: "335px" },    // Dealer at Seat 2
        { left: "-215px", top: "265px" },  // Dealer at Seat 3
        { left: "-169px", top: "28px" },   // Dealer at Seat 4
        { left: "150px", top: "-50px" },   // Dealer at Seat 5
        { left: "285px", top: "-50px" },   // Dealer at Seat 6
        { left: "635px", top: "30px" },    // Dealer at Seat 7
        { left: "680px", top: "265px" },   // Dealer at Seat 8
        { left: "445px", top: "331px" }    // Dealer at Seat 9
      ]
    },
    
    // TURN INDICATOR ANIMATIONS
    turnAnimations: {
      // 4-PLAYER TURN INDICATORS
      four: [
        { left: "450px", top: "500px" },   // Turn indicator Seat 1
        { left: "-110px", top: "260px" },  // Turn indicator Seat 2
        { left: "450px", top: "-20px" },  // Turn indicator Seat 3
        { left: "999px", top: "250px" }    // Turn indicator Seat 4
      ],
      
      // 6-PLAYER TURN INDICATORS
      six: [
        { left: "40%", top: "100%" },    // Turn indicator at Seat 1
        { left: "17%", top: "32%" },     // Turn indicator at Seat 2
        { left: "40%", top: "-35%" },    // Turn indicator at Seat 3
        { left: "60%", top: "-35%" },    // Turn indicator at Seat 4
        { left: "83%", top: "32%" },     // Turn indicator at Seat 5
        { left: "60%", top: "100%" }     // Turn indicator at Seat 6
      ],
      
      // 9-PLAYER TURN INDICATORS
      nine: [
        { left: "450px", top: "470px" },   // Turn indicator at Seat 1
        { left: "155px", top: "460px" },   // Turn indicator at Seat 2
        { left: "-104px", top: "320px" },  // Turn indicator at Seat 3
        { left: "-59px", top: "69px" },    // Turn indicator at Seat 4
        { left: "267px", top: "-10px" },   // Turn indicator at Seat 5
        { left: "600px", top: "-10px" },   // Turn indicator at Seat 6
        { left: "960px", top: "69px" },    // Turn indicator at Seat 7
        { left: "999px", top: "320px" },   // Turn indicator at Seat 8
        { left: "740px", top: "460px" }    // Turn indicator at Seat 9
      ]
    },
    
    // WIN CELEBRATION ANIMATIONS
    winAnimations: {
      // 4-PLAYER WIN ANIMATIONS
      four: [
        { left: "450px", top: "399px" },   // Win animation Seat 1
        { left: "-110px", top: "175px" },  // Win animation Seat 2
        { left: "450px", top: "-110px" },  // Win animation Seat 3
        { left: "999px", top: "175px" }    // Win animation Seat 4
      ],
      
      // 6-PLAYER WIN ANIMATIONS
      six: [
        { left: "40%", top: "100%" },    // Win animation at Seat 1
        { left: "17%", top: "32%" },     // Win animation at Seat 2
        { left: "40%", top: "-35%" },    // Win animation at Seat 3
        { left: "60%", top: "-35%" },    // Win animation at Seat 4
        { left: "83%", top: "32%" },     // Win animation at Seat 5
        { left: "60%", top: "100%" }     // Win animation at Seat 6
      ],
      
      // 9-PLAYER WIN ANIMATIONS
      nine: [
        { left: "450px", top: "470px" },   // Win animation at Seat 1
        { left: "155px", top: "460px" },   // Win animation at Seat 2
        { left: "-104px", top: "320px" },  // Win animation at Seat 3
        { left: "-59px", top: "69px" },    // Win animation at Seat 4
        { left: "267px", top: "-10px" },   // Win animation at Seat 5
        { left: "600px", top: "-10px" },   // Win animation at Seat 6
        { left: "960px", top: "69px" },    // Win animation at Seat 7
        { left: "999px", top: "320px" },   // Win animation at Seat 8
        { left: "740px", top: "460px" }    // Win animation at Seat 9
      ]
    }
  }
};

// Get current configuration based on viewport
export const getCurrentConfig = (): ViewportConfig => {
  const mode = getViewportMode();
  return viewportConfigs[mode];
};

// Helper to get specific position arrays
export const getPositionArrays = (tableSize: 4 | 6 | 9) => {
  const config = getCurrentConfig();
  const sizeKey = tableSize === 4 ? "four" : tableSize === 6 ? "six" : "nine";
  
  return {
    players: config.players[sizeKey],
    vacantPlayers: config.vacantPlayers[sizeKey],
    chips: config.chips[sizeKey],
    dealers: config.dealers[sizeKey],
    turnAnimations: config.turnAnimations[sizeKey],
    winAnimations: config.winAnimations[sizeKey]
  };
};

// Calculate dynamic zoom based on viewport
export const calculateTableZoom = (): number => {
  const mode = getViewportMode();
  
  // Define base table dimensions
  const TABLE_WIDTH = 900;
  const TABLE_HEIGHT = 450;
  
  // Minimum and maximum scale limits
  const MIN_SCALE = 0.3;
  const MAX_SCALE = 2.0;
  
  // =====================================================
  // DESKTOP CALCULATION
  // =====================================================
  if (mode === "desktop") {
    // ========== DESKTOP SETTINGS - ADJUST THESE! ==========
    
    // MINIMUM SCALE: The smallest the table can be on desktop
    // Lower value = smaller table minimum size
    // Try: 0.3, 0.4, 0.5 for smaller tables
    const DESKTOP_MIN_SCALE = 0.3;  // Allow table to shrink more on very short screens
    
    // MAXIMUM SCALE: The largest the table can be on desktop  
    // Higher value = bigger table on large screens
    // Try: 1.0, 1.2, 1.5, 2.0 for bigger tables on large monitors
    const DESKTOP_MAX_SCALE = 1.2;
    
    // HORIZONTAL PADDING: Space on left + right sides
    // Higher value = more space around table horizontally
    // Lower value = table can be wider
    // Try: 100 (tight), 200 (normal), 300 (spacious)
    const DESKTOP_PADDING_H = 200;
    
    // VERTICAL PADDING: Space on top + bottom (for header/footer)
    // Higher value = more space for UI elements, smaller table
    // Lower value = bigger table but might cut off at top/bottom
    // Try: 200 (tight), 300 (normal), 400 (safe)
    // NOTE: If top cards are cut off, also adjust translateY in desktop config (line 761)
    const DESKTOP_PADDING_V = 300;  // Increased to prevent cutoff at typical desktop heights
    
    // TARGET SCALE: Ideal scale for medium screens (1920x1080)
    // This is what we "aim for" on standard desktop screens
    // Try: 0.6 (small), 0.8 (medium), 1.0 (large)
    const DESKTOP_TARGET_SCALE = 0.8;
    
    // ========== CALCULATION LOGIC ==========
    
    // Calculate available space after padding
    const availableWidth = window.innerWidth - DESKTOP_PADDING_H;
    const availableHeight = window.innerHeight - DESKTOP_PADDING_V;
    
    // Calculate scale needed to fit width and height
    const scaleByWidth = availableWidth / TABLE_WIDTH;
    const scaleByHeight = availableHeight / TABLE_HEIGHT;
    
    // Debug logging - remove after testing
    // console.log('Desktop scaling debug:', {
    //   windowSize: `${window.innerWidth}x${window.innerHeight}`,
    //   padding: `H:${DESKTOP_PADDING_H}, V:${DESKTOP_PADDING_V}`,
    //   availableSpace: `${availableWidth}x${availableHeight}`,
    //   scaleByWidth,
    //   scaleByHeight
    // });
    
    // Use the smaller scale to ensure table fits in viewport
    const fitScale = Math.min(scaleByWidth, scaleByHeight);
    
    // For large screens, allow scaling up to DESKTOP_MAX_SCALE
    // For small screens, ensure we don't go below DESKTOP_MIN_SCALE
    let finalScale;
    
    if (window.innerWidth > 1920) {
      // Large screens: Scale up but not beyond max
      finalScale = Math.min(fitScale, DESKTOP_MAX_SCALE);
    } else if (window.innerWidth > 1440) {
      // Medium screens: Use target scale or fit scale, whichever is smaller
      finalScale = Math.min(fitScale, DESKTOP_TARGET_SCALE);
    } else {
      // Small desktop screens: Ensure minimum scale
      finalScale = Math.max(Math.min(fitScale, DESKTOP_TARGET_SCALE), DESKTOP_MIN_SCALE);
    }
    
    // Final bounds check
    const result = Math.max(MIN_SCALE, Math.min(finalScale, MAX_SCALE));
    // console.log("Desktop final scale:", result);
    return result;
  }
  
  // =====================================================
  // TABLET CALCULATION
  // =====================================================
  else if (mode === "tablet") {
    // ========== TABLET SETTINGS - ADJUST THESE! ==========
    
    // MAXIMUM SCALE: Largest size for tablets
    // Try: 0.6 (small), 0.8 (medium), 1.0 (large)
    const TABLET_MAX_SCALE = 0.8;
    
    // HORIZONTAL PADDING: Space on sides
    // Try: 50 (tight), 100 (normal), 150 (spacious)
    const TABLET_PADDING_H = 100;
    
    // VERTICAL PADDING: Space top/bottom
    // Try: 150 (tight), 200 (normal), 250 (safe)
    const TABLET_PADDING_V = 200;
    
    // ========== CALCULATION ==========
    const availableWidth = window.innerWidth - TABLET_PADDING_H;
    const availableHeight = window.innerHeight - TABLET_PADDING_V;
    
    const scaleByWidth = availableWidth / TABLE_WIDTH;
    const scaleByHeight = availableHeight / TABLE_HEIGHT;
    
    const fitScale = Math.min(scaleByWidth, scaleByHeight);
    const finalScale = Math.min(fitScale, TABLET_MAX_SCALE);
    
    return Math.max(MIN_SCALE, Math.min(finalScale, MAX_SCALE));
  }
  
  // =====================================================
  // MOBILE LANDSCAPE CALCULATION
  // =====================================================
  else if (mode === "mobile-landscape") {
    // ========== MOBILE LANDSCAPE SETTINGS - ADJUST THESE! ==========
    
    // MAXIMUM SCALE: Largest size for mobile landscape
    // Try: 0.5 (tiny), 0.7 (small), 0.9 (medium)
    const MOBILE_LANDSCAPE_MAX_SCALE = 0.7;
    
    // HORIZONTAL PADDING: Space on sides (usually minimal on mobile)
    // Try: 20 (very tight), 50 (normal), 100 (spacious)
    const MOBILE_LANDSCAPE_PADDING_H = 50;
    
    // VERTICAL PADDING: Space top/bottom (for controls)
    // Try: 80 (tight), 100 (normal), 150 (safe)
    const MOBILE_LANDSCAPE_PADDING_V = 100;
    
    // ========== CALCULATION ==========
    const availableWidth = window.innerWidth - MOBILE_LANDSCAPE_PADDING_H;
    const availableHeight = window.innerHeight - MOBILE_LANDSCAPE_PADDING_V;
    
    const scaleByWidth = availableWidth / TABLE_WIDTH;
    const scaleByHeight = availableHeight / TABLE_HEIGHT;
    
    const fitScale = Math.min(scaleByWidth, scaleByHeight);
    const finalScale = Math.min(fitScale, MOBILE_LANDSCAPE_MAX_SCALE);
    
    return Math.max(MIN_SCALE, Math.min(finalScale, MAX_SCALE));
  }
  
  // =====================================================
  // MOBILE PORTRAIT CALCULATION
  // =====================================================
  else {
    // ========== MOBILE PORTRAIT SETTINGS - ADJUST THESE! ==========
    
    // MAXIMUM SCALE: Largest size for mobile portrait
    // Try: 0.3 (tiny), 0.5 (small), 0.7 (medium)
    const MOBILE_PORTRAIT_MAX_SCALE = 0.5;
    
    // HORIZONTAL PADDING: Space on sides (minimal on mobile)
    // Try: 10 (very tight), 20 (normal), 40 (spacious)
    const MOBILE_PORTRAIT_PADDING_H = 20;
    
    // VERTICAL PADDING: Space top/bottom (needs room for controls)
    // Try: 120 (tight), 150 (normal), 200 (safe)
    const MOBILE_PORTRAIT_PADDING_V = 150;
    
    // ========== CALCULATION ==========
    const availableWidth = window.innerWidth - MOBILE_PORTRAIT_PADDING_H;
    const availableHeight = window.innerHeight - MOBILE_PORTRAIT_PADDING_V;
    
    const scaleByWidth = availableWidth / TABLE_WIDTH;
    const scaleByHeight = availableHeight / TABLE_HEIGHT;
    
    const fitScale = Math.min(scaleByWidth, scaleByHeight);
    const finalScale = Math.min(fitScale, MOBILE_PORTRAIT_MAX_SCALE);
    
    return Math.max(MIN_SCALE, Math.min(finalScale, MAX_SCALE));
  }
};

// Export a method to update configurations dynamically (for testing/debugging)
export const updateViewportConfig = (
  mode: string,
  updates: Partial<ViewportConfig>
): void => {
  viewportConfigs[mode] = {
    ...viewportConfigs[mode],
    ...updates
  };
};