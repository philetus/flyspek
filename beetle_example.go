package main

import (
    "fmt"
    // "github.com/gopherjs/gopherjs/js"
    "github.com/go-gl/mathgl/mgl32"
    "github.com/philetus/flyspek/mesh"
    "github.com/philetus/flyspek/pane"
)

var (
    c = make([]mgl32.Vec2, 9) // array of control point position vecs
    q = make([]mgl32.Vec2, 10) // array of quadratic curve control vecs

    // c0x & c0y can be adjusted, everything else follows
    c0x float32 = 0
    c0y float32 = 0

    // parameters for adjustable control points, relative to c0
    c0dy float32 = 0
    c1dy float32 = -50
    c2dy float32 = 95
    c4dx float32 = 40
    c5dx float32 = 50
    c5dy float32 = 70

    q0dx float32 = 10
    q0dy float32 = -14
    q1dx float32 = -2
    q1dy float32 = -8
    q2dx float32 = 2
    q2dy float32 = 8
    q3dx float32 = 20
    q3dy float32 = 5
    q4dx float32 = 15
    q4dy float32 = 20

    frstDot int = 9
    dotx, doty float32 = 6, 9

    pointerDown bool
    slctdC int = -1
    lstPnt mgl32.Vec2
    slctRd float32 = 6
)

func main() {

    pn := pane.New()


    pn.SetZoom(4.0, 4.0)
    pn.SetPan(100.0, 100.0)

    ms := makeMeshes()
    pn.Draw(ms...)

    // loop and handle pointer events
    for {
        select {
        case pntrEvnt := <- pn.PointerPipe:
            switch pntrEvnt.Flvr {

            case pane.DOWN:
                pointerDown = true
                fmt.Printf("pointer down at %v\n", pntrEvnt.Pos)
                if pointAt(pntrEvnt.Pos) {
                    ms := makeMeshes()
                    pn.Draw(ms...)
                }

            case pane.UP:
                fmt.Printf("pointer up at %v\n", pntrEvnt.Pos)
                pointerDown = false

            case pane.MOVE:
                if pointerDown && (slctdC >= 0) {
                    moveC(pntrEvnt.Pos)
                    ms := makeMeshes()
                    pn.Draw(ms...)
                }
            }
        }
    }
}

func pointAt(v mgl32.Vec2) bool {
    for i, p := range c {
        if p.Sub(v).Len() < slctRd { // if v is within select radius of c[i]
            slctdC = i
            lstPnt = v
            return true
        }
    }
    slctdC = -1
    return false
}

func moveC(v mgl32.Vec2) {
    d := v.Sub(lstPnt) // calculate delta vec
    lstPnt = v

    switch slctdC {

    case 0:
        c0dy += d[1]

    case 1:
        c1dy += d[1]

    case 2:
        c2dy += d[1]

    case 4:
        c4dx += d[0]

    case 5:
        c5dx += d[0]
        c5dy += d[1]
    }
}

// regenerate meshes
func makeMeshes() (ms []mesh.Mesh) {

    resolveValues() // generate initial vectors to make meshes

    chst := makeChest()
    ms = append(ms, chst)
    rwng := makeRWing()
    ms = append(ms, rwng)
    lwng := makeLWing()
    ms = append(ms, lwng)


    // add dots at control points
    mgnt := mgl32.Vec4{1.0, 0.0, 1.0, 0.7} // magentaish
    grn := mgl32.Vec4{0.0, 1.0, 0.0, 0.7} // greenish
    for i, v := range c {
        switch i {

        case 0, 1, 2:
            d := makeDot(v, 1.57, i + frstDot, mgnt)
            ms = append(ms, d)

        case 4:
            d := makeDot(v, 0, i + frstDot, mgnt)
            ms = append(ms, d)

        case 5:
            d := makeDot(v, -0.79, i + frstDot, mgnt)
            ms = append(ms, d)

        case 7:
            d := makeDot(v, 0, i + frstDot, grn)
            ms = append(ms, d)

        case 8:
            d := makeDot(v, 0.79, i + frstDot, grn)
            ms = append(ms, d)
        }
    }

    // draw q control points
    // for i, v := range q {
    //     d := makeDot(v, 0, i + frstDot + 10, mgl32.Vec4{1.0, 1.0, 1.0, 0.7})
    //     ms = append(ms, d)
    // }

    return ms
}

func makeDot(v mgl32.Vec2, a float32, i int, clr mgl32.Vec4) mesh.Mesh {
    m := mesh.Mesh{
        Nmbr: mesh.Number(i),
        Dpth: 0.5,
        Vrts: []mgl32.Vec2{
                {-dotx, 0}, // 0
                {0, -doty}, // 1
                {dotx, 0}, // 2
                {0, doty}, // 3
            },
        Clrs: []mgl32.Vec4{
            clr, 
            },
        Trngls: []mesh.Triangle{
                {
                    Vnd: mesh.Nd{0, 1, 2},
                    Flvr: mesh.CONVEX,
                },
                {
                    Vnd: mesh.Nd{2, 3, 0},
                    Flvr: mesh.CONVEX,
                },
            },
        }
    m.Transform(mgl32.HomogRotate2D(a)) // rotate by a
    m.Transform(mgl32.Translate2D(v.Elem())) // translate by v
    return m
}

func makeChest() mesh.Mesh {
    return mesh.Mesh{
        Nmbr: 1,
        Dpth: 1.0,
        Vrts: []mgl32.Vec2{
                c[0], //  0
                q[7], //  1
                c[6], //  2
                q[6], //  3
                c[7], //  4
                q[5], //  5
                c[1], //  6
                q[0], //  7
                c[4], //  8
                q[1], //  9
                c[3], // 10
                q[2], // 11
            },
        Clrs: []mgl32.Vec4{
                {1.0, 1.0, 0.0, 1.0}, // yellow
            },
        Trngls: []mesh.Triangle{
                { 
                    Vnd: mesh.Nd{0, 1, 2}, // c0, q7, c6
                    Flvr: mesh.CONVEX, 
                },
                { 
                    Vnd: mesh.Nd{10, 11, 0}, // c3, q2, c0
                    Flvr: mesh.CONVEX, 
                },
                { 
                    Vnd: mesh.Nd{4, 3, 2}, // c7, q6, c6
                    Flvr: mesh.CONCAVE,
                },
                { 
                    Vnd: mesh.Nd{10, 9, 8}, // c3, q1, c4
                    Flvr: mesh.CONCAVE,
                },
                { 
                    Vnd: mesh.Nd{4, 5, 6}, // c7, q5, c1
                    Flvr: mesh.CONVEX,
                },
                { 
                    Vnd: mesh.Nd{6, 7, 8}, // c1, q0, c4
                    Flvr: mesh.CONVEX,
                },
                { 
                    Vnd: mesh.Nd{0, 2, 3}, // c0, c6, q6
                },
                { 
                    Vnd: mesh.Nd{0, 9, 10}, // c0, q1, c3
                },
                { 
                    Vnd: mesh.Nd{0, 3, 6}, // c0, q6, c1
                },
                { 
                    Vnd: mesh.Nd{0, 6, 9}, // c0, c1, q1
                },
                { 
                    Vnd: mesh.Nd{4, 6, 3}, // c7, c1, q6
                },
                { 
                    Vnd: mesh.Nd{8, 9, 6}, // c4, q1, c1
                },
            },
        }
}

func makeRWing() mesh.Mesh {
    return mesh.Mesh{
        Nmbr: 2,
        Dpth: 1.1,
        Vrts: []mgl32.Vec2{
                c[0], //  0
                q[2], //  1
                c[3], //  2
                q[1], //  3
                c[4], //  4
                q[3], //  5
                c[5], //  6
                q[4], //  7
                c[2], //  8
            },
        Clrs: []mgl32.Vec4{
                {0.0, 0.0, 1.0, 1.0}, // blue
            },
        Trngls: []mesh.Triangle{
                { 
                    Vnd: mesh.Nd{2, 1, 0}, // c3, q2, c0
                    Flvr: mesh.CONCAVE, 
                },
                { 
                    Vnd: mesh.Nd{2, 3, 4}, // c3, q1, c4
                    Flvr: mesh.CONVEX, 
                },
                { 
                    Vnd: mesh.Nd{4, 5, 6}, // c4, q3, c5
                    Flvr: mesh.CONVEX,
                },
                { 
                    Vnd: mesh.Nd{6, 7, 8}, // c5, q4, c2
                    Flvr: mesh.CONVEX,
                },
                { 
                    Vnd: mesh.Nd{8, 0, 1}, // c2, c0, q2
                },
                { 
                    Vnd: mesh.Nd{8, 1, 6}, // c2, q2, c5
                },
                { 
                    Vnd: mesh.Nd{6, 1, 4}, // c5, q2, c4
                },
                { 
                    Vnd: mesh.Nd{1, 2, 4}, // q2, c3, c4
                },
            },
        }
}

func makeLWing() mesh.Mesh {
    return mesh.Mesh{
        Nmbr: 3,
        Dpth: 1.2,
        Vrts: []mgl32.Vec2{
                c[0], //  0
                q[7], //  1
                c[6], //  2
                q[6], //  3
                c[7], //  4
                q[8], //  5
                c[8], //  6
                q[9], //  7
                c[2], //  8
            },
        Clrs: []mgl32.Vec4{
                {1.0, 0.0, 0.0, 1.0}, // red
            },
        Trngls: []mesh.Triangle{
                { 
                    Vnd: mesh.Nd{2, 1, 0}, // c3, q2, c0
                    Flvr: mesh.CONCAVE, 
                },
                { 
                    Vnd: mesh.Nd{2, 3, 4}, // c3, q1, c4
                    Flvr: mesh.CONVEX, 
                },
                { 
                    Vnd: mesh.Nd{4, 5, 6}, // c4, q3, c5
                    Flvr: mesh.CONVEX,
                },
                { 
                    Vnd: mesh.Nd{6, 7, 8}, // c5, q4, c2
                    Flvr: mesh.CONVEX,
                },
                { 
                    Vnd: mesh.Nd{8, 0, 1}, // c2, c0, q2
                },
                { 
                    Vnd: mesh.Nd{8, 1, 6}, // c2, q2, c5
                },
                { 
                    Vnd: mesh.Nd{6, 1, 4}, // c5, q2, c4
                },
                { 
                    Vnd: mesh.Nd{1, 2, 4}, // q2, c3, c4
                },
            },
        }
}

func resolveValues() {
    c[0][0] = c0x
    c[0][1] = c0y + c0dy

    c[1][0] = c0x
    c[1][1] = c0y + c1dy

    c[2][0] = c0x
    c[2][1] = c0y + c2dy

    c[4][0] = c0x + c4dx
    c[7][0] = c0x - c4dx
    c[4][1] = c0y + (c1dy / 2.0)
    c[7][1] = c[4][1]

    c[3][0], c[3][1] = tween(c[0], c[4])
    c[6][0], c[6][1] = tween(c[0], c[7])

    c[5][0] = c0x + c5dx
    c[8][0] = c0x - c5dx
    c[5][1] = c0y + c5dy
    c[8][1] = c[5][1]

    q[0][0], q[0][1] = tweenQ(c[1], c[4], mgl32.Vec2{q0dx, q0dy})
    q[5][0], q[5][1] = tweenQ(c[7], c[1], mgl32.Vec2{-q0dx, q0dy})

    q[1][0], q[1][1] = tweenQ(c[3], c[4], mgl32.Vec2{q1dx, q1dy})
    q[6][0], q[6][1] = tweenQ(c[7], c[6], mgl32.Vec2{-q1dx, q1dy})

    q[2][0], q[2][1] = tweenQ(c[3], c[0], mgl32.Vec2{q2dx, q2dy})
    q[7][0], q[7][1] = tweenQ(c[0], c[6], mgl32.Vec2{-q2dx, q2dy})

    q[3][0], q[3][1] = tweenQ(c[4], c[5], mgl32.Vec2{q3dx, q3dy})
    q[8][0], q[8][1] = tweenQ(c[8], c[7], mgl32.Vec2{-q3dx, q3dy})

    q[4][0], q[4][1] = tweenQ(c[5], c[2], mgl32.Vec2{q4dx, q4dy})
    q[9][0], q[9][1] = tweenQ(c[2], c[8], mgl32.Vec2{-q4dx, q4dy})
}

func tween(a, b mgl32.Vec2) (x, y float32) {
    v := b.Sub(a)    
    v = v.Mul(0.5)    
    v = a.Add(v)

    return v.Elem()
}

func tweenQ(a, b, c mgl32.Vec2) (x, y float32) {
    v := b.Sub(a)
    v = v.Mul(0.5)
    v = a.Add(v)
    v = v.Add(c)

    return v.Elem()
}

