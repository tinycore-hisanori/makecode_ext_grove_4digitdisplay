// Grove 4-Digit Display (TM1637) driver for micro:bit MakeCode
// Uses 2 pins: CLK and DIO (not I2C)

namespace grove4digit {
    //% color=#D81B60 icon="\uf26c"
    //% block="Grove 4-Digit Display"
    //% block.loc.ja="Grove 4桁7セグ"
    export namespace tm1637 {
        let _inited = false
        let _clk: DigitalPin
        let _dio: DigitalPin
        let _brightness = 7 // 0..7
        let _enabled = true

        function delay() { control.waitMicros(5) }

        function start() {
            pins.digitalWritePin(_dio, 1)
            pins.digitalWritePin(_clk, 1)
            delay()
            pins.digitalWritePin(_dio, 0)
            delay()
            pins.digitalWritePin(_clk, 0)
        }

        function stop() {
            pins.digitalWritePin(_clk, 0)
            delay()
            pins.digitalWritePin(_dio, 0)
            delay()
            pins.digitalWritePin(_clk, 1)
            delay()
            pins.digitalWritePin(_dio, 1)
            delay()
        }

        // TM1637: LSB-first
        function writeByte(b: number): boolean {
            for (let i = 0; i < 8; i++) {
                pins.digitalWritePin(_clk, 0)
                delay()
                pins.digitalWritePin(_dio, (b & 0x01) ? 1 : 0)
                delay()
                pins.digitalWritePin(_clk, 1)
                delay()
                b >>= 1
            }

            // ACK
            pins.digitalWritePin(_clk, 0)
            pins.digitalWritePin(_dio, 1) // release
            delay()
            pins.digitalWritePin(_clk, 1)
            delay()
            const ack = (pins.digitalReadPin(_dio) === 0)
            pins.digitalWritePin(_clk, 0)
            delay()
            return ack
        }

        function command(cmd: number) {
            start()
            writeByte(cmd & 0xFF)
            stop()
        }

        function setData(address: number, data: number) {
            start()
            writeByte(0xC0 | (address & 0x03))
            writeByte(data & 0xFF)
            stop()
        }

        function encodeDigit(d: number): number {
            // segments: 0b0GFEDCBA
            const table = [
                0x3f, 0x06, 0x5b, 0x4f, 0x66,
                0x6d, 0x7d, 0x07, 0x7f, 0x6f
            ]
            if (d >= 0 && d <= 9) return table[d]
            return 0x00
        }

        function encodeChar(ch: string): number {
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

        function applyBrightness() {
            // display control: 0x88 + (ON?0x08:0) + brightness(0..7)
            command(0x88 | (_enabled ? 0x08 : 0x00) | (_brightness & 0x07))
        }

        /**
         * Initialize TM1637 4-digit display with pins.
         * @param clk CLK pin
         * @param dio DIO pin
         */
        //% block="init 4-digit display clk %clk dio %dio"
        //% block.loc.ja="4桁7セグ初期化 clk %clk dio %dio"
        //% jsdoc.loc.ja="TM1637方式の4桁7セグを初期化します（2ピン: CLK/DIO）。"
        //% clk.fieldEditor="gridpicker" clk.fieldOptions.columns=4
        //% dio.fieldEditor="gridpicker" dio.fieldOptions.columns=4
        export function init(clk: DigitalPin, dio: DigitalPin) {
            _clk = clk
            _dio = dio
            _inited = true

            pins.setPull(_clk, PinPullMode.PullUp)
            pins.setPull(_dio, PinPullMode.PullUp)
            pins.digitalWritePin(_clk, 1)
            pins.digitalWritePin(_dio, 1)

            _brightness = 7
            _enabled = true
            applyBrightness()
            clear()
        }

        /**
         * Set brightness (0..7) and display on/off.
         */
        //% block="set brightness %level display on %on"
        //% block.loc.ja="明るさ %level 表示ON %on"
        //% jsdoc.loc.ja="明るさ(0〜7)と表示ON/OFFを設定します。"
        //% level.min=0 level.max=7
        //% on.defl=true
        export function setBrightness(level: number, on: boolean = true) {
            if (!_inited) return
            _brightness = Math.max(0, Math.min(7, level | 0))
            _enabled = !!on
            applyBrightness()
        }

        /**
         * Clear all digits.
         */
        //% block="clear display"
        //% block.loc.ja="表示クリア"
        //% jsdoc.loc.ja="4桁を消灯します。"
        export function clear() {
            if (!_inited) return
            command(0x40) // auto-increment mode
            for (let i = 0; i < 4; i++) setData(i, 0x00)
            applyBrightness()
        }

        /**
         * Show a number (-999..9999).
         */
        //% block="show number %value leadingZero %leadingZero"
        //% block.loc.ja="数字表示 %value 0埋め %leadingZero"
        //% jsdoc.loc.ja="数値を表示します（-999〜9999）。"
        //% leadingZero.defl=false
        export function showNumber(value: number, leadingZero: boolean = false) {
            if (!_inited) return
            let v = value | 0
            let neg = false
            if (v < 0) { neg = true; v = -v }
            if (v > 9999) v = 9999

            const d0 = (v / 1000) | 0
            const d1 = ((v / 100) | 0) % 10
            const d2 = ((v / 10) | 0) % 10
            const d3 = v % 10

            let o0 = encodeDigit(d0)
            let o1 = encodeDigit(d1)
            let o2 = encodeDigit(d2)
            let o3 = encodeDigit(d3)

            if (!leadingZero) {
                if (d0 === 0) o0 = 0
                if (d0 === 0 && d1 === 0) o1 = 0
                if (d0 === 0 && d1 === 0 && d2 === 0) o2 = 0
            }

            if (neg) {
                // put '-' to the leftmost blank if possible
                if (o0 === 0) o0 = 0x40
                else if (o1 === 0) o1 = 0x40
                else if (o2 === 0) o2 = 0x40
                else o0 = 0x40
            }

            showRaw(o0, o1, o2, o3)
        }

        /**
         * Show time as MM:SS (colon on).
         */
        //% block="show time mm %mm ss %ss"
        //% block.loc.ja="時刻表示 分 %mm 秒 %ss"
        //% jsdoc.loc.ja="MM:SS形式で表示します（中央のコロン点灯）。"
        //% mm.min=0 mm.max=99
        //% ss.min=0 ss.max=59
        export function showTime(mm: number, ss: number) {
            if (!_inited) return
            const m = Math.max(0, Math.min(99, mm | 0))
            const s = Math.max(0, Math.min(59, ss | 0))

            const m1 = (m / 10) | 0
            const m2 = m % 10
            const s1 = (s / 10) | 0
            const s2 = s % 10

            const o0 = encodeDigit(m1)
            const o1 = encodeDigit(m2) | 0x80 // colon (typical)
            const o2 = encodeDigit(s1)
            const o3 = encodeDigit(s2)

            showRaw(o0, o1, o2, o3)
        }

        /**
         * Show raw segment bytes (0b0GFEDCBA). Use 0x80 for colon on digit2.
         */
        //% block="show raw d0 %d0 d1 %d1 d2 %d2 d3 %d3"
        //% block.loc.ja="生セグ表示 d0 %d0 d1 %d1 d2 %d2 d3 %d3"
        //% jsdoc.loc.ja="セグメントの生データ(4バイト)で表示します。"
        export function showRaw(d0: number, d1: number, d2: number, d3: number) {
            if (!_inited) return
            command(0x40) // auto-increment
            setData(0, d0)
            setData(1, d1)
            setData(2, d2)
            setData(3, d3)
            applyBrightness()
        }

        /**
         * Show up to 4 characters (best effort).
         */
        //% block="show text %text"
        //% block.loc.ja="文字表示 %text"
        //% jsdoc.loc.ja="4文字を表示します（対応文字のみ、足りない分は空白）。"
        export function showText(text: string) {
            if (!_inited) return
            const t = (text || "")
            const c0 = t.length > 0 ? t.charAt(0) : " "
            const c1 = t.length > 1 ? t.charAt(1) : " "
            const c2 = t.length > 2 ? t.charAt(2) : " "
            const c3 = t.length > 3 ? t.charAt(3) : " "

            const d0 = (c0 >= "0" && c0 <= "9") ? encodeDigit(parseInt(c0)) : encodeChar(c0)
            const d1 = (c1 >= "0" && c1 <= "9") ? encodeDigit(parseInt(c1)) : encodeChar(c1)
            const d2 = (c2 >= "0" && c2 <= "9") ? encodeDigit(parseInt(c2)) : encodeChar(c2)
            const d3 = (c3 >= "0" && c3 <= "9") ? encodeDigit(parseInt(c3)) : encodeChar(c3)

            showRaw(d0, d1, d2, d3)
        }
    }
}
