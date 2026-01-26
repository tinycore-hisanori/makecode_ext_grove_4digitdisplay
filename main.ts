namespace grove4digit {
    //% color=#D81B60 icon="\uf26c"
    //% block="Grove 4-Digit Display"
    //% block.loc.ja="Grove 4桁7セグ"
    export class TM1637 {
        private clk: DigitalPin
        private dio: DigitalPin
        private brightness: number = 7 // 0..7
        private enabled: boolean = true

        constructor(clk: DigitalPin, dio: DigitalPin) {
            this.clk = clk
            this.dio = dio
            pins.setPull(this.clk, PinPullMode.PullUp)
            pins.setPull(this.dio, PinPullMode.PullUp)
            pins.digitalWritePin(this.clk, 1)
            pins.digitalWritePin(this.dio, 1)
            this.setBrightness(7, true)
            this.clear()
        }

        private delay() {
            control.waitMicros(5)
        }

        private start() {
            pins.digitalWritePin(this.dio, 1)
            pins.digitalWritePin(this.clk, 1)
            this.delay()
            pins.digitalWritePin(this.dio, 0)
            this.delay()
            pins.digitalWritePin(this.clk, 0)
        }

        private stop() {
            pins.digitalWritePin(this.clk, 0)
            this.delay()
            pins.digitalWritePin(this.dio, 0)
            this.delay()
            pins.digitalWritePin(this.clk, 1)
            this.delay()
            pins.digitalWritePin(this.dio, 1)
            this.delay()
        }

        private writeByte(b: number): boolean {
            // LSB first
            for (let i = 0; i < 8; i++) {
                pins.digitalWritePin(this.clk, 0)
                this.delay()
                pins.digitalWritePin(this.dio, (b & 0x01) ? 1 : 0)
                this.delay()
                pins.digitalWritePin(this.clk, 1)
                this.delay()
                b >>= 1
            }

            // ACK
            pins.digitalWritePin(this.clk, 0)
            pins.digitalWritePin(this.dio, 1) // release
            this.delay()
            pins.digitalWritePin(this.clk, 1)
            this.delay()
            const ack = (pins.digitalReadPin(this.dio) === 0)
            pins.digitalWritePin(this.clk, 0)
            this.delay()
            return ack
        }

        private command(cmd: number) {
            this.start()
            this.writeByte(cmd & 0xFF)
            this.stop()
        }

        private setData(address: number, data: number) {
            // 0xC0 + addr
            this.start()
            this.writeByte(0xC0 | (address & 0x03))
            this.writeByte(data & 0xFF)
            this.stop()
        }

        private encodeDigit(d: number): number {
            // segments: 0b0GFEDCBA (typical TM1637 mapping)
            // 0-9
            const table = [
                0x3f, // 0
                0x06, // 1
                0x5b, // 2
                0x4f, // 3
                0x66, // 4
                0x6d, // 5
                0x7d, // 6
                0x07, // 7
                0x7f, // 8
                0x6f  // 9
            ]
            if (d >= 0 && d <= 9) return table[d]
            return 0x00
        }

        private encodeChar(ch: string): number {
            // minimal set (you can add more later)
            switch (ch) {
                case " ": return 0x00
                case "-": return 0x40
                case "_": return 0x08
                case "A": case "a": return 0x77
                case "b": return 0x7C
                case "C": case "c": return 0x39
                case "d": return 0x5E
                case "E": case "e": return 0x79
                case "F": case "f": return 0x71
                case "H": case "h": return 0x76
                case "L": case "l": return 0x38
                case "n": return 0x54
                case "o": return 0x5C
                case "P": case "p": return 0x73
                case "r": return 0x50
                case "t": return 0x78
                case "U": case "u": return 0x3E
                default: return 0x00
            }
        }

        /**
         * Set brightness (0..7) and power on/off.
         * %param level brightness 0..7
         * %param on true = display on
         */
        //% block="set brightness %level on %on"
        //% block.loc.ja="明るさ %level 表示ON %on"
        //% jsdoc.loc.ja="明るさ(0〜7)と表示ON/OFFを設定します。"
        //% level.min=0 level.max=7
        //% on.defl=true
        export setBrightness(level: number, on: boolean = true) {
            this.brightness = Math.max(0, Math.min(7, level | 0))
            this.enabled = !!on
            // display control command: 0x88 + brightness, bit3 is ON
            this.command(0x88 | (this.enabled ? 0x08 : 0x00) | (this.brightness & 0x07))
        }

        /**
         * Clear all digits.
         */
        //% block="clear"
        //% block.loc.ja="クリア"
        //% jsdoc.loc.ja="4桁を消灯します。"
        export clear() {
            // set auto-increment mode
            this.command(0x40)
            for (let i = 0; i < 4; i++) this.setData(i, 0x00)
            this.setBrightness(this.brightness, this.enabled)
        }

        /**
         * Display a number (-999..9999).
         * %param value number
         * %param leadingZero show leading zeros
         */
        //% block="show number %value leadingZero %leadingZero"
        //% block.loc.ja="数字表示 %value 0埋め %leadingZero"
        //% jsdoc.loc.ja="数値を表示します（-999〜9999）。"
        //% leadingZero.defl=false
        export showNumber(value: number, leadingZero: boolean = false) {
            let v = value | 0
            let neg = false
            if (v < 0) { neg = true; v = -v }

            // limit
            if (v > 9999) v = 9999

            const d0 = (v / 1000) | 0
            const d1 = ((v / 100) | 0) % 10
            const d2 = ((v / 10) | 0) % 10
            const d3 = v % 10

            const out = [0, 0, 0, 0]
            out[0] = this.encodeDigit(d0)
            out[1] = this.encodeDigit(d1)
            out[2] = this.encodeDigit(d2)
            out[3] = this.encodeDigit(d3)

            if (!leadingZero) {
                if (d0 === 0) out[0] = 0
                if (d0 === 0 && d1 === 0) out[1] = 0
                if (d0 === 0 && d1 === 0 && d2 === 0) out[2] = 0
            }

            if (neg) {
                // put '-' on leftmost available
                if (out[0] === 0) out[0] = 0x40
                else if (out[1] === 0) out[1] = 0x40
                else if (out[2] === 0) out[2] = 0x40
                else out[0] = 0x40
            }

            this.showRaw(out[0], out[1], out[2], out[3])
        }

        /**
         * Display time as MM:SS (colon on).
         */
        //% block="show time mm %mm ss %ss"
        //% block.loc.ja="時刻表示 分 %mm 秒 %ss"
        //% jsdoc.loc.ja="MM:SS形式で表示します（中央のコロン点灯）。"
        //% mm.min=0 mm.max=99
        //% ss.min=0 ss.max=59
        export showTime(mm: number, ss: number) {
            const m = Math.max(0, Math.min(99, mm | 0))
            const s = Math.max(0, Math.min(59, ss | 0))
            const m1 = (m / 10) | 0
            const m2 = m % 10
            const s1 = (s / 10) | 0
            const s2 = s % 10
            // colon is typically bit 0x80 on digit1 (2nd digit)
            const d0 = this.encodeDigit(m1)
            const d1 = this.encodeDigit(m2) | 0x80
            const d2 = this.encodeDigit(s1)
            const d3 = this.encodeDigit(s2)
            this.showRaw(d0, d1, d2, d3)
        }

        /**
         * Display 4 raw segment bytes.
         * Each byte: 0b0GFEDCBA (plus 0x80 for colon on digit 2).
         */
        //% block="show raw d0 %d0 d1 %d1 d2 %d2 d3 %d3"
        //% block.loc.ja="生セグ表示 d0 %d0 d1 %d1 d2 %d2 d3 %d3"
        //% jsdoc.loc.ja="セグメントの生データ(4バイト)で表示します。"
        export showRaw(d0: number, d1: number, d2: number, d3: number) {
            // auto-increment
            this.command(0x40)
            this.setData(0, d0)
            this.setData(1, d1)
            this.setData(2, d2)
            this.setData(3, d3)
            this.setBrightness(this.brightness, this.enabled)
        }

        /**
         * Display 4 characters (best effort).
         * Supported: 0-9, A-F, -, _, space, some letters.
         */
        //% block="show text %text"
        //% block.loc.ja="文字表示 %text"
        //% jsdoc.loc.ja="4文字を表示します（対応文字のみ、足りない分は空白）。"
        export showText(text: string) {
            const t = (text || "")
            const c0 = t.length > 0 ? t.charAt(0) : " "
            const c1 = t.length > 1 ? t.charAt(1) : " "
            const c2 = t.length > 2 ? t.charAt(2) : " "
            const c3 = t.length > 3 ? t.charAt(3) : " "
            const d0 = this.isDigit(c0) ? this.encodeDigit(parseInt(c0)) : this.encodeChar(c0)
            const d1 = this.isDigit(c1) ? this.encodeDigit(parseInt(c1)) : this.encodeChar(c1)
            const d2 = this.isDigit(c2) ? this.encodeDigit(parseInt(c2)) : this.encodeChar(c2)
            const d3 = this.isDigit(c3) ? this.encodeDigit(parseInt(c3)) : this.encodeChar(c3)
            this.showRaw(d0, d1, d2, d3)
        }

        private isDigit(c: string): boolean {
            return c >= "0" && c <= "9"
        }
    }

    /**
     * Create a Grove 4-Digit Display (TM1637).
     * Uses 2 pins: CLK and DIO.
     */
    //% block="create 4-digit display clk %clk dio %dio"
    //% block.loc.ja="4桁7セグ作成 clk %clk dio %dio"
    //% jsdoc.loc.ja="TM1637方式の4桁7セグを作成します（2ピン: CLK/DIO）。"
    export function create(clk: DigitalPin, dio: DigitalPin): TM1637 {
        return new TM1637(clk, dio)
    }
}
