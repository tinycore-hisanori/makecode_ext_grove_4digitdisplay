/**
 * Grove 4-Digit Display (TM1637) - MakeCode for micro:bit
 * Block-friendly (init with pins), and API names close to Seeed:
 *   init(clk,dio), set(brightness), point(onoff), display(...), clearDisplay()
 */

namespace grove4DigitDisplay {
    //% color=#D81B60 icon="\uf26c"
    //% block="Grove 4-Digit Display"
    //% block.loc.ja="Grove 4桁7セグ"
    export namespace TM1637 {
        // ---- constants (Seeed-like) ----
        export const BRIGHT_DARKEST = 0
        export const BRIGHT_TYPICAL = 2
        export const BRIGHTEST = 7

        export const POINT_OFF = 0
        export const POINT_ON = 1

        // ---- internal state ----
        let _inited = false
        let _clk: DigitalPin
        let _dio: DigitalPin

        let cmd_set_data = 0x40
        let cmd_set_addr = 0xC0
        let cmd_disp_ctrl = 0x8A // ON + BRIGHT_TYPICAL(2)

        let _point = false

        // 0..9,A,b,C,d,E,F  (0..15)
        const tubeTab: number[] = [
            0x3f, 0x06, 0x5b, 0x4f, 0x66,
            0x6d, 0x7d, 0x07, 0x7f, 0x6f,
            0x77, 0x7c, 0x39, 0x5e, 0x79,
            0x71
        ]

        function delay() { control.waitMicros(5) }

        function start() {
            pins.digitalWritePin(_dio, 1)
            pins.digitalWritePin(_clk, 1)
            delay()
            pins.digitalWritePin(_dio, 0)
            pins.digitalWritePin(_clk, 0)
            delay()
        }

        function stop() {
            pins.digitalWritePin(_clk, 0)
            pins.digitalWritePin(_dio, 0)
            delay()
            pins.digitalWritePin(_clk, 1)
            pins.digitalWritePin(_dio, 1)
            delay()
        }

        function writeByte(data: number) {
            // TM1637: LSB first
            for (let i = 0; i < 8; i++) {
                pins.digitalWritePin(_clk, 0)
                delay()
                pins.digitalWritePin(_dio, (data & 0x01) ? 1 : 0)
                delay()
                pins.digitalWritePin(_clk, 1)
                delay()
                data >>= 1
            }

            // ACK (module pulls DIO low). We don't hard-fail if not seen.
            pins.digitalWritePin(_clk, 0)
            pins.digitalWritePin(_dio, 1) // release
            delay()
            pins.digitalWritePin(_clk, 1)
            delay()
            // optional ack read:
            // const ack = (pins.digitalReadPin(_dio) === 0)
            pins.digitalWritePin(_clk, 0)
            delay()
        }

        function writeCmd(cmd: number) {
            start()
            writeByte(cmd & 0xFF)
            stop()
        }

        function setData(addr: number, data: number) {
            start()
            writeByte(cmd_set_addr | (addr & 0x03))
            writeByte(data & 0xFF)
            stop()
        }

        function applyPoint(buf: number[]) {
            if (_point) {
                // typical: colon is bit7 on digit1 (2nd digit)
                buf[1] = (buf[1] | 0x80) & 0xFF
            }
        }

        function encodeDigit(d: number): number {
            if (d < 0 || d > 15) return 0x00
            return tubeTab[d] & 0xFF
        }

        function encodeNumber(n: number): number[] {
            // Seeed互換っぽく：右寄せ、先頭は空白、負数は左に'-'
            let v = n | 0
            if (v > 9999) v = 9999
            if (v < -999) v = -999

            const out = [0x00, 0x00, 0x00, 0x00]

            if (v < 0) {
                const abs = (-v) | 0
                out[0] = 0x40 // '-'
                const s = abs.toString()
                // 右寄せで残り3桁に詰める
                for (let i = 0; i < s.length && i < 3; i++) {
                    const ch = s.charAt(s.length - 1 - i)
                    out[3 - i] = encodeDigit(parseInt(ch))
                }
                return out
            }

            const s = v.toString()
            for (let i = 0; i < s.length && i < 4; i++) {
                const ch = s.charAt(s.length - 1 - i)
                out[3 - i] = encodeDigit(parseInt(ch))
            }
            return out
        }

        function displayRaw(buf: number[]) {
            // auto-increment
            writeCmd(cmd_set_data)
            for (let i = 0; i < 4; i++) setData(i, buf[i] & 0xFF)
            // display control
            writeCmd(cmd_disp_ctrl)
        }

        /**
         * Initialize display with CLK/DIO pins.
         * @param clk CLK pin
         * @param dio DIO pin
         */
        //% block="init 4-digit display clk %clk dio %dio"
        //% block.loc.ja="4桁7セグ初期化 clk %clk dio %dio"
        //% jsdoc.loc.ja="CLK/DIOピンを指定して初期化します。"
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

            // default like Seeed
            set(BRIGHT_TYPICAL)
            clearDisplay()
        }

        /**
         * Set brightness (0..7).
         * @param brightness 0..7
         */
        //% block="set brightness %brightness"
        //% block.loc.ja="明るさ設定 %brightness"
        //% jsdoc.loc.ja="明るさを設定します（0〜7）。"
        //% brightness.min=0 brightness.max=7
        export function set(brightness: number) {
            if (!_inited) return
            let b = brightness | 0
            if (b < 0) b = 0
            if (b > 7) b = 7
            // 0x88 = display ON, low 3 bits = brightness
            cmd_disp_ctrl = 0x88 | b
            writeCmd(cmd_disp_ctrl)
        }

        /**
         * Turn colon/point on/off.
         * @param onoff POINT_ON / POINT_OFF
         */
        //% block="point %onoff"
        //% block.loc.ja="コロン %onoff"
        //% jsdoc.loc.ja="中央のコロンをON/OFFします（POINT_ON / POINT_OFF）。"
        export function point(onoff: number) {
            if (!_inited) return
            _point = (onoff === POINT_ON)
        }

        /**
         * Clear display.
         */
        //% block="clear display"
        //% block.loc.ja="表示クリア"
        //% jsdoc.loc.ja="表示を消去します。"
        export function clearDisplay() {
            if (!_inited) return
            displayRaw([0x00, 0x00, 0x00, 0x00])
        }

        /**
         * Display a number (right aligned).
         * @param value number
         */
        //% block="display number %value"
        //% block.loc.ja="数字表示 %value"
        //% jsdoc.loc.ja="数値を表示します（右寄せ）。"
        export function displayNumber(value: number) {
            if (!_inited) return
            const buf = encodeNumber(value)
            applyPoint(buf)
            displayRaw(buf)
        }

        /**
         * Display digit at position (0..3), digit 0..15 (0-9,A-F).
         * @param position 0..3
         * @param digit 0..15
         */
        //% block="display pos %position digit %digit"
        //% block.loc.ja="位置 %position に表示 digit %digit"
        //% jsdoc.loc.ja="指定位置(0〜3)に1桁表示します。digitは0〜15（0-9,A-F）。"
        //% position.min=0 position.max=3
        //% digit.min=0 digit.max=15
        export function display(position: number, digit: number) {
            if (!_inited) return
            let pos = position | 0
            if (pos < 0) pos = 0
            if (pos > 3) pos = 3

            const buf = [0x00, 0x00, 0x00, 0x00]
            buf[pos] = encodeDigit(digit)
            applyPoint(buf)
            displayRaw(buf)
        }
    }
}
