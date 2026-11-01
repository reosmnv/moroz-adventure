// Генерирует tools/enemy_build.py (Claude). Руками не править.
export interface EnemyClip { frames: number; fps: number; loop: boolean; hit?: number }
export const ENEMY_ANIMS: Partial<Record<string, Record<string, EnemyClip>>> = {
  "clerk": {
    "idle": {
      "frames": 8,
      "fps": 8,
      "loop": true
    },
    "walk": {
      "frames": 6,
      "fps": 10,
      "loop": true
    },
    "hurt": {
      "frames": 6,
      "fps": 14,
      "loop": false
    },
    "fall": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "getup": {
      "frames": 5,
      "fps": 10,
      "loop": false
    },
    "windup": {
      "frames": 7,
      "fps": 9,
      "loop": false
    },
    "strike": {
      "frames": 4,
      "fps": 24,
      "loop": false
    },
    "recover": {
      "frames": 4,
      "fps": 7,
      "loop": false
    }
  },
  "info_f": {
    "idle": {
      "frames": 8,
      "fps": 8,
      "loop": true
    },
    "walk": {
      "frames": 6,
      "fps": 10,
      "loop": true
    },
    "hurt": {
      "frames": 6,
      "fps": 14,
      "loop": false
    },
    "fall": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "getup": {
      "frames": 5,
      "fps": 10,
      "loop": false
    },
    "windup": {
      "frames": 7,
      "fps": 16,
      "loop": false
    },
    "strike": {
      "frames": 3,
      "fps": 19,
      "loop": false
    },
    "recover": {
      "frames": 5,
      "fps": 14,
      "loop": false
    }
  },
  "info_m": {
    "idle": {
      "frames": 8,
      "fps": 8,
      "loop": true
    },
    "walk": {
      "frames": 6,
      "fps": 10,
      "loop": true
    },
    "hurt": {
      "frames": 6,
      "fps": 14,
      "loop": false
    },
    "fall": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "getup": {
      "frames": 5,
      "fps": 10,
      "loop": false
    },
    "windup": {
      "frames": 6,
      "fps": 11,
      "loop": false
    },
    "dash": {
      "frames": 5,
      "fps": 15,
      "loop": false
    },
    "recover": {
      "frames": 4,
      "fps": 9,
      "loop": false
    }
  },
  "omon": {
    "idle": {
      "frames": 8,
      "fps": 8,
      "loop": true
    },
    "walk": {
      "frames": 6,
      "fps": 10,
      "loop": true
    },
    "hurt": {
      "frames": 6,
      "fps": 14,
      "loop": false
    },
    "fall": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "getup": {
      "frames": 5,
      "fps": 10,
      "loop": false
    },
    "windup": {
      "frames": 7,
      "fps": 16,
      "loop": false
    },
    "strike": {
      "frames": 3,
      "fps": 19,
      "loop": false
    },
    "recover": {
      "frames": 5,
      "fps": 14,
      "loop": false
    }
  },
  "omon_shield": {
    "idle": {
      "frames": 8,
      "fps": 8,
      "loop": true
    },
    "walk": {
      "frames": 6,
      "fps": 10,
      "loop": true
    },
    "hurt": {
      "frames": 6,
      "fps": 14,
      "loop": false
    },
    "fall": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "getup": {
      "frames": 5,
      "fps": 10,
      "loop": false
    },
    "windup": {
      "frames": 7,
      "fps": 9,
      "loop": false
    },
    "strike": {
      "frames": 2,
      "fps": 12,
      "loop": false
    },
    "recover": {
      "frames": 5,
      "fps": 9,
      "loop": false
    }
  },
  "pizdulina": {
    "idle": {
      "frames": 8,
      "fps": 8,
      "loop": true
    },
    "walk": {
      "frames": 6,
      "fps": 10,
      "loop": true
    },
    "hurt": {
      "frames": 6,
      "fps": 14,
      "loop": false
    },
    "fall": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "windup": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "strike": {
      "frames": 3,
      "fps": 19,
      "loop": false
    },
    "recover": {
      "frames": 6,
      "fps": 12,
      "loop": false
    },
    "cast": {
      "frames": 7,
      "fps": 9,
      "loop": false
    },
    "release": {
      "frames": 9,
      "fps": 12,
      "loop": false
    }
  },
  "shaman": {
    "idle": {
      "frames": 8,
      "fps": 8,
      "loop": true
    },
    "walk": {
      "frames": 6,
      "fps": 10,
      "loop": true
    },
    "hurt": {
      "frames": 6,
      "fps": 14,
      "loop": false
    },
    "fall": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "windup": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "strike": {
      "frames": 3,
      "fps": 19,
      "loop": false
    },
    "recover": {
      "frames": 5,
      "fps": 10,
      "loop": false
    },
    "cast": {
      "frames": 8,
      "fps": 10,
      "loop": false
    },
    "release": {
      "frames": 8,
      "fps": 12,
      "loop": false
    }
  },
  "vatnik": {
    "idle": {
      "frames": 8,
      "fps": 8,
      "loop": true
    },
    "walk": {
      "frames": 6,
      "fps": 10,
      "loop": true
    },
    "hurt": {
      "frames": 6,
      "fps": 14,
      "loop": false
    },
    "fall": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "getup": {
      "frames": 5,
      "fps": 10,
      "loop": false
    },
    "windup": {
      "frames": 7,
      "fps": 16,
      "loop": false
    },
    "strike": {
      "frames": 3,
      "fps": 19,
      "loop": false
    },
    "recover": {
      "frames": 5,
      "fps": 14,
      "loop": false
    }
  },
  "zek": {
    "idle": {
      "frames": 8,
      "fps": 8,
      "loop": true
    },
    "walk": {
      "frames": 6,
      "fps": 10,
      "loop": true
    },
    "hurt": {
      "frames": 6,
      "fps": 14,
      "loop": false
    },
    "fall": {
      "frames": 7,
      "fps": 12,
      "loop": false
    },
    "getup": {
      "frames": 5,
      "fps": 10,
      "loop": false
    },
    "windup": {
      "frames": 6,
      "fps": 11,
      "loop": false
    },
    "dash": {
      "frames": 4,
      "fps": 12,
      "loop": false
    },
    "recover": {
      "frames": 5,
      "fps": 11,
      "loop": false
    }
  }
};
