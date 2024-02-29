/*
 * Copyright (c) 2020-2023  Moddable Tech, Inc.
 *
 *   This file is part of the Moddable SDK Runtime.
 * 
 *   The Moddable SDK Runtime is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 * 
 *   The Moddable SDK Runtime is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Lesser General Public License for more details.
 * 
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with the Moddable SDK Runtime.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
 
import AXP2101 from "axp2101"; //変更
import MPU6886 from "mpu6886";
import AudioOut from "pins/audioout";
import Resource from "Resource";
import Timer from "timer";
import config from "mc/config";
import I2C from "pins/i2c";

const INTERNAL_I2C = Object.freeze({
	sda: 21,
	scl: 22
});

const state = {
  handleRotation: nop,
};

globalThis.Host = {
  Backlight: class {
    constructor(brightness = 100) {
      this.write(brightness);
    }
    write(value) {
      if (undefined !== globalThis.power)
        globalThis.power.brightness = value;
    }
    close() {}
  }
}

class M5Core2Button {		// M5StackCoreTouch calls write when button changes 
	#value = 0;
	read() {
		return this.#value;
	}
	write(value) {
		if (this.#value === value)
			return;
		this.#value = value;
		this.onChanged?.();
	}
}

export default function (done) {
	// buttons
	globalThis.button = {
		a: new M5Core2Button,
		b: new M5Core2Button,
		c: new M5Core2Button,
	};

	// power
	globalThis.power = new Power();

	// speaker
	power.speaker.enable = true;

	// start-up sound
	if (config.startupSound) {
    const speaker = new AudioOut({streams: 1});
		speaker.callback = function () {
			this.stop();
			this.close();
			Timer.set(this.done);
		};
		speaker.done = done;
		done = undefined;

		speaker.enqueue(0, AudioOut.Samples, new Resource(config.startupSound));
		speaker.enqueue(0, AudioOut.Callback, 0);
		speaker.start();
	}

  // vibration
  globalThis.vibration = {
    read: function () {
      return power.vibration.enable;
    },
    write: function (v) {
      power.vibration.enable = v;
    },
  };

  if (config.startupVibration) {
    vibration.write(true);
    Timer.set(() => {
      vibration.write(false);
    }, config.startupVibration);
  }

  // accelerometer and gyrometer
  const test = new I2C({...INTERNAL_I2C, address: 0x68, throw: false});
  test.write(0x75, false);
  const ok = test.read(1);
  test.close();
  if (undefined !== ok) {
    state.accelerometerGyro = new MPU6886(INTERNAL_I2C);

    globalThis.accelerometer = {
      onreading: nop,
    };

    globalThis.gyro = {
      onreading: nop,
    };

    accelerometer.start = function (frequency) {
      accelerometer.stop();
      state.accelerometerTimerID = Timer.repeat((id) => {
        state.accelerometerGyro.configure({
          operation: "accelerometer",
        });
        const sample = state.accelerometerGyro.sample();
        if (sample) {
          state.handleRotation(sample);
          accelerometer.onreading(sample);
        }
      }, frequency);
    };

    gyro.start = function (frequency) {
      gyro.stop();
      state.gyroTimerID = Timer.repeat((id) => {
        state.accelerometerGyro.configure({
          operation: "gyroscope",
        });
        const sample = state.accelerometerGyro.sample();
        if (sample) {
          let { x, y, z } = sample;
          const temp = x;
          x = y * -1;
          y = temp * -1;
          z *= -1;
          gyro.onreading({
            x,
            y,
            z,
          });
        }
      }, frequency);
    };

    accelerometer.stop = function () {
      if (undefined !== state.accelerometerTimerID)
        Timer.clear(state.accelerometerTimerID);
      delete state.accelerometerTimerID;
    };

    gyro.stop = function () {
      if (undefined !== state.gyroTimerID) Timer.clear(state.gyroTimerID);
      delete state.gyroTimerID;
    };
  }

  // autorotate
  if (config.autorotate && globalThis.Application && globalThis.accelerometer) {
    state.handleRotation = function (reading) {
      if (globalThis.application === undefined) return;

      if (Math.abs(reading.y) > Math.abs(reading.x)) {
        if (reading.y < -0.7 && application.rotation != 180) {
          application.rotation = 180;
        } else if (reading.y > 0.7 && application.rotation != 0) {
          application.rotation = 0;
        }
      } else {
        if (reading.x < -0.7 && application.rotation != 270) {
          application.rotation = 270;
        } else if (reading.x > 0.7 && application.rotation != 90) {
          application.rotation = 90;
        }
      }
    };
    accelerometer.start(300);
  }
  
  // レジスタの値を出力したい
  let regvalue = 0;
  for (var ireg = 0; ireg <= 0xff; ireg++){
	regvalue = power.readByte(ireg);
	trace(`register: ${ireg.toString(16)}\t value: ${regvalue.toString(16)}\n`);  
  }

  done?.();
}

// 回路図に合わせてポートを変更
class Power extends AXP2101 {
  constructor() {
    super(INTERNAL_I2C);

    this.writeByte(0x27, 0x00); // PowerKey Hold=1sec / PowerOff=4sec
    this.writeByte(0x10, 0x30); // PMU common config (internal off-discharge enable)
    this.writeByte(0x12, 0x00); // BATFET disable
    this.writeByte(0x68, 0x01); // Battery detection enabled.
    this.writeByte(0x69, 0x13); // CHGLED setting
    this.writeByte(0x99, 0x00); // DLDO1 set 0.5v (vibration motor)

	// DCDC1&3  Enable
	this.writeByte(0x80, this.readByte(0x00) | 0x04);
	
    // main power line
    this._dcdc1.voltage = 3350;
    //this.chargeEnable = true; // これがあるとなぜか動かない

    // LCD
    this.lcd = this._bldo1;
    this.lcd.voltage = 2800;
    this.lcd.enable = true;

    // internal LCD logic
    this._aldo4.voltage = 3300;
    this._aldo4.enable = true;

    // Vibration
    this.vibration = this._dldo1;
    this.vibration.voltage = 2000;

    // Speaker
    this.speaker = this._aldo3;
    this.speaker.voltage = 3300;

    // AXP192 GPIO4 -> AXP2101 ALDO2
    this._aldo2.voltage = 3300;
    this.resetLcd();
	// bus power mode_output
    this._bldo2.voltage = 3300;
    this._bldo2.enable = true;
	Timer.delay(200);
  }

  resetLcd() {
    this._aldo2.enable = false;
    Timer.delay(20);
    this._aldo2.enable = true;
  }

  // value 0 - 100 %
  set brightness(value) {
    if (value <= 0)
      value = 2500;
    else if (value >= 100)
      value = 3300;
    else
      value = (value / 100) * 800 + 2500;
    this.lcd.voltage = value;
  }
  
  get brightness() {
    return (this.lcd.voltage - 2500) / 800 * 100;
  }
}

function nop() {}
