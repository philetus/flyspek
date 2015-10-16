package main

import (
    "github.com/gopherjs/gopherjs/js"
    "github.com/gopherjs/webgl"
)

const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec4 a_color;

    uniform vec2 u_resolution;

    varying vec4 v_color;

    void main() {

        // convert the position from pixels to 0.0 to 1.0
        vec2 zeroToOne = a_position / u_resolution;

        // convert from 0->1 to 0->2
        vec2 zeroToTwo = zeroToOne * 2.0;

        // convert from 0->2 to -1->+1 (clipspace)
        vec2 clipSpace = zeroToTwo - 1.0;

        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        v_color = a_color;
    }
`
const fragShaderSource = `
    precision mediump float;

    varying vec4 v_color;

    void main() {
        gl_FragColor = v_color;
    }
`

func main() {
    document := js.Global.Get("document")
    canvas := document.Call("createElement", "canvas")
    document.Get("body").Call("appendChild", canvas)

    js.Global.Get("console").Call("log", "running webgl_example!")

    attrs := webgl.DefaultAttributes()
    attrs.Alpha = false

    gl, err := webgl.NewContext(canvas, attrs)
    if err != nil {
        js.Global.Call("alert", "Error: "+err.Error())
        return
    }

    // init shader program
    shader, ok := initShader(gl, canvas)
    if !ok { return }

    // set blend function for when alpha blending is enabled
    gl.BlendFuncSeparate( 
        gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE)
    gl.Enable(gl.BLEND)

    // get gl shader variables
    uResolution := gl.GetUniformLocation(shader, "u_resolution")
    aPosition := gl.GetAttribLocation(shader, "a_position")
    gl.EnableVertexAttribArray(aPosition)
    aColor := gl.GetAttribLocation(shader, "a_color")
    gl.EnableVertexAttribArray(aColor)

    // set viewport
    setResolution(gl, canvas, uResolution)

    // draw something
    gl.ClearColor(0.0, 1.0, 1.0, 1.0) // cyanish
    gl.Clear(gl.COLOR_BUFFER_BIT)

    vertices := []float32{
            16.0, 16.0, 
            128.0, 16.0, 
            128.0, 128.0,
            128.0, 128.0, 
            16.0, 128.0, 
            16.0, 16.0}
    vrtxBuff := gl.CreateBuffer()
    gl.BindBuffer(gl.ARRAY_BUFFER, vrtxBuff)
    gl.BufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    gl.VertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

    rgba := []float32{
            1.0, 0.0, 0.0, 0.7, // reddish
            1.0, 0.0, 0.0, 0.7,
            1.0, 0.0, 0.0, 0.7,
            1.0, 0.0, 0.0, 0.7,
            1.0, 0.0, 0.0, 0.7,
            1.0, 0.0, 0.0, 0.7}
    rgbaBuff := gl.CreateBuffer()
    gl.BindBuffer(gl.ARRAY_BUFFER, rgbaBuff)
    gl.BufferData(gl.ARRAY_BUFFER, rgba, gl.STATIC_DRAW)
    gl.VertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0)

    gl.DrawArrays(gl.TRIANGLES, 0, 6);
}

func initShader(gl *webgl.Context, canvas *js.Object) (*js.Object, bool) {
    shader := gl.CreateProgram()
    vertexShader, ok := getShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    if !ok { 
        js.Global.Call("alert", "Error getting vertex shader")
        return nil, false
    }
    fragShader, ok := getShader( gl, gl.FRAGMENT_SHADER, fragShaderSource)
    if !ok { 
        js.Global.Call("alert", "Error getting fragment shader")
        return nil, false
    }
    gl.AttachShader(shader, vertexShader)
    gl.AttachShader(shader, fragShader)
    gl.LinkProgram(shader)
    if !gl.GetProgramParameterb(shader, gl.LINK_STATUS) {
        js.Global.Call("alert", "couldnt init shaders :(")
        return nil, false
    }
    gl.UseProgram(shader)

    return shader, true
}

func setResolution(
        gl *webgl.Context, canvas *js.Object, uResolution *js.Object) {
    width := canvas.Get("clientWidth").Int()
    height := canvas.Get("clientHeight").Int()

    if (canvas.Get("width").Int() != width) || 
            (canvas.Get("height").Int() != height) {
        canvas.Set("width", width)
        canvas.Set("height", height)
    }
    gl.Viewport(0, 0, width, height);
    gl.Uniform2f(uResolution, float32(width), float32(height))
}

func getShader(gl *webgl.Context, typ int, source string) (*js.Object, bool) {
    shader := gl.CreateShader(typ)

    gl.ShaderSource(shader, source)
    gl.CompileShader(shader)

    if !gl.GetShaderParameter(shader, gl.COMPILE_STATUS).Bool() {
        js.Global.Call("alert", gl.GetShaderInfoLog(shader))
        return nil, false
    }
    return shader, true
}