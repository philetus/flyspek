package pane

import (
    //"fmt"
    "github.com/gopherjs/gopherjs/js"
)

const vertexShaderSource = `
    attribute vec2 a_vertex;
    attribute vec2 a_bezier;
    attribute float a_curve;
    attribute vec4 a_color;

    uniform mat3 u_transform; // local coordinate transform

    varying vec2 v_bezier;
    varying float v_curve;
    varying vec4 v_color;

    void main(void) {       
        vec3 transformed = u_transform * vec3(a_vertex, 1.0);
        gl_Position = vec4(transformed * vec3(1.0, -1.0, 0.0), 1.0);
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
        float alpha = clamp((0.5 - sd), 0.0, v_color.w);
        gl_FragColor = vec4(v_color.x, v_color.y, v_color.z, alpha);
    }
`

func (self *pane) initShaders() {

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

    self.uTransform = self.gl.GetUniformLocation(self.shader, "u_transform")
}


func (self *pane) getShader(typ int, src string) (shader *js.Object) {
    shader = self.gl.CreateShader(typ)
    self.gl.ShaderSource(shader, src)
    self.gl.CompileShader(shader)
    
    if !self.gl.GetShaderParameter(shader, self.gl.COMPILE_STATUS).Bool() {
        self.Log(self.gl.GetShaderInfoLog(shader))
        return nil
    }
    return shader
}