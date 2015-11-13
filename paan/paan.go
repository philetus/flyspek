package paan

import (
    "github.com/gopherjs/gopherjs/js"
    "github.com/gopherjs/webgl"
    "github.com/go-gl/mathgl/mgl32" // vector & matrix lib
    "github.com/philetus/flyspek/mesh2"
)

const vertexShaderSource = `
    attribute vec2 a_vertex;
    attribute vec2 a_bezier;
    attribute float a_curve;
    attribute vec4 a_color;

    uniform mat4 uMVMatrix;
    uniform mat4 uPMatrix;

    varying vec2 v_bezier;
    varying float v_curve;
    varying vec4 v_color;

    void main(void) {
        gl_Position = uPMatrix * uMVMatrix * vec4(a_vertex, 0.0, 1.0);
        v_bezier = a_bezier;
        v_curve = a_curve;
        v_color = a_color;
    }
`
const fragShaderSource = `
    #extension GL_OES_standard_derivatives : enable

    #ifdef GL_ES
    precision highp float;
    #endif

    varying vec2 v_bezier;
    varying float v_curve;
    varying vec4 v_color;

    void main(void) {
        vec2 px = dFdx(v_bezier);
        vec2 py = dFdy(v_bezier);
        float fx = 2.0 * v_bezier.x * px.x - px.y;
        float fy = 2.0 * v_bezier.y * py.x - py.y;
        float sd = v_curve * (v_bezier.x * v_bezier.x - v_bezier.y) / sqrt(fx * fx + fy * fy);
        float alpha = clamp((0.5 - sd) * v_color.w, 0.0, 1.0);
        gl_FragColor = vec4(v_color.x, v_color.y, v_color.z, alpha);
    }
`

//type PointerHandler func(pnt mgl32.Vec2)

type paan struct { // paan type hidden, call paan.New() to create paan
    console *js.Object // browser console to log to

    document *js.Object
    canvas *js.Object
    gl *webgl.Context
    width, height int

    shader *js.Object  // gl.shader
    uMVMatrix, uPMatrix *js.Object // uniform shader variables
    aVertex, aBezier, aCurve, aColor int // varying shader variables

    meshdeks map[mesh2.Number]*glbuff
}

func New() *paan {
    self := new(paan) // allocate new paan struct
    self.meshdeks = make(map[mesh2.Number]*glbuff) // allocate mesh buffer map

    // connect console
    self.console = js.Global.Get("console")
    self.Log("creating new paan")

    // create canvas and append to document
    self.document = js.Global.Get("document")
    self.canvas = self.document.Call("createElement", "canvas")
    self.document.Get("body").Call("appendChild", self.canvas)

    // load gl context
    attrs := webgl.DefaultAttributes()
    attrs.Alpha = false
    gl, err := webgl.NewContext(self.canvas, attrs)
    if err != nil {
        self.Log("error: "+err.Error())
        return nil
    }
    self.gl = gl

    // init shaders
    self.initShaders()

    // set blend function for when alpha blending is enabled
    self.gl.BlendFuncSeparate( 
        self.gl.SRC_ALPHA, self.gl.ONE_MINUS_SRC_ALPHA, 
        self.gl.ZERO, self.gl.ONE)
    self.gl.Enable(self.gl.BLEND)


    // init canvas resolution
    //self.setResolution()

    return self
}

func (self *paan) initShaders() {

    // enable gl flags
    self.gl.GetExtension("OES_standard_derivatives")

    // init shader
    self.shader = self.gl.CreateProgram()
    //self.Log(vertexShaderSource)
    //self.Log(fragShaderSource)
    vertexShader := self.getShader(self.gl.VERTEX_SHADER, vertexShaderSource)
    fragShader := self.getShader(self.gl.FRAGMENT_SHADER, fragShaderSource)
    self.gl.AttachShader(self.shader, vertexShader)
    self.gl.AttachShader(self.shader, fragShader)
    self.gl.LinkProgram(self.shader)
    if !self.gl.GetProgramParameterb(self.shader, self.gl.LINK_STATUS) {
        self.Log("couldnt init shaders :(")
    }
    self.gl.UseProgram(self.shader)

    // get gl shader variables
    self.aVertex = self.gl.GetAttribLocation(self.shader, "a_vertex")
    self.gl.EnableVertexAttribArray(self.aVertex)
    self.aBezier = self.gl.GetAttribLocation(self.shader, "a_bezier")
    self.gl.EnableVertexAttribArray(self.aBezier)
    self.aCurve = self.gl.GetAttribLocation(self.shader, "a_curve")
    self.gl.EnableVertexAttribArray(self.aCurve)
    self.aColor = self.gl.GetAttribLocation(self.shader, "a_color")
    self.gl.EnableVertexAttribArray(self.aColor)

    self.uMVMatrix = self.gl.GetUniformLocation(self.shader, "uMVMatrix")
    self.uPMatrix = self.gl.GetUniformLocation(self.shader, "uPMatrix")
}

func (self *paan) Log(msg string) {
    self.console.Call("log", msg)
}

func (self *paan) getShader(typ int, src string) (shader *js.Object) {
    shader = self.gl.CreateShader(typ)
    self.gl.ShaderSource(shader, src)
    self.gl.CompileShader(shader)
    
    if !self.gl.GetShaderParameter(shader, self.gl.COMPILE_STATUS).Bool() {
        self.Log(self.gl.GetShaderInfoLog(shader))
        return nil
    }
    return shader
}

func (self *paan) SetResolution() {
    self.width = self.canvas.Get("clientWidth").Int()
    self.height = self.canvas.Get("clientHeight").Int()

    if (self.canvas.Get("width").Int() != self.width) || 
            (self.canvas.Get("height").Int() != self.height) {
        self.canvas.Set("width", self.width)
        self.canvas.Set("height", self.height)
    }
    self.gl.Viewport(0, 0, self.width, self.height);
    // self.gl.Uniform2f(
    //     self.uResolution, float32(self.width), float32(self.height))
}

func (self *paan) Draw() {
    self.SetResolution()
    self.gl.ClearColor(0.0, 1.0, 1.0, 1.0) // cyanish
    self.gl.Clear(self.gl.COLOR_BUFFER_BIT | self.gl.DEPTH_BUFFER_BIT)

    // set up uniform matrices
    pMatrix := mgl32.Perspective(
        mgl32.DegToRad(45.0), 
        float32(self.width)/float32(self.height),
        0.1, 100.0)
    self.gl.UniformMatrix4fv(self.uPMatrix, false, floatifyMat4(pMatrix));

    mvMatrix := mgl32.Translate3D(0.0, 0.0, -4.0)
    self.gl.UniformMatrix4fv(self.uMVMatrix, false, floatifyMat4(mvMatrix));

    for _, bff := range self.meshdeks {
        self.drawBuff(bff)
    }
}

func floatifyMat4(m mgl32.Mat4) (f []float32) {
    for _, s := range m {
        f = append(f, float32(s))
    }
    return f
}