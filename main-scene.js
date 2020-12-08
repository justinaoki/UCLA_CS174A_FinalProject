import {defs, tiny} from './examples/common.js';
import {Axes_Viewer, Axes_Viewer_Test_Scene} from "./examples/axes-viewer.js"
import {Collision_Demo, Inertia_Demo} from "./examples/collisions-demo.js"
import {Many_Lights_Demo} from "./examples/many-lights-demo.js"
import {Obj_File_Demo} from "./examples/obj-file-demo.js"
import {Scene_To_Texture_Demo} from "./examples/scene-to-texture-demo.js"
import {Surfaces_Demo} from "./examples/surfaces-demo.js"
import {Text_Demo} from "./examples/text-demo.js"
import {Transforms_Sandbox} from "./examples/transforms-sandbox.js"
import {MyScene} from "./examples/Height_Lerp.js"
import {Plane} from "./examples/plane.js"
import {HouseScene} from "./HouseScene.js"
// Pull these names into this module's scope for convenience:
const {
    Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene,
    Canvas_Widget, Code_Widget, Text_Widget
} = tiny;

// Now we have loaded everything in the files tiny-graphics.js, tiny-graphics-widgets.js, and common.js.
// This yielded "tiny", an object wrapping the stuff in the first two files, and "defs" for wrapping all the rest.

// ******************** Extra step only for when executing on a local machine:
//                      Load any more files in your directory and copy them into "defs."
//                      (On the web, a server should instead just pack all these as well
//                      as common.js into one file for you, such as "dependencies.js")

const Minimal_Webgl_Demo = defs.Minimal_Webgl_Demo;

export class Shape_From_File extends Shape {                                   // **Shape_From_File** is a versatile standalone Shape that imports
                                                                               // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) {                             // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then(response => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                this.copy_onto_graphics_card(this.gl);
            })
    }

    parse_into_mesh(data) {                           // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/;
        var NORMAL_RE = /^vn\s/;
        var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;
        var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split('/');

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const {verts, norms, textures} = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready)
            super.draw(context, program_state, model_transform, material);
    }
}

Object.assign(defs,
    {Axes_Viewer, Axes_Viewer_Test_Scene},
            {Inertia_Demo, Collision_Demo},
            {Many_Lights_Demo},
            {Obj_File_Demo},
            {Scene_To_Texture_Demo},
            {Surfaces_Demo},
            {Text_Demo},
            {Transforms_Sandbox});

// ******************** End extra step

export class House extends Scene {                           // **Obj_File_Demo** show how to load a single 3D model from an OBJ file.
                                                                     // Detailed model files can be used in place of simpler primitive-based
                                                                     // shapes to add complexity to a scene.  Simpler primitives in your scene
                                                                     // can just be thought of as placeholders until you find a model file
                                                                     // that fits well.  This demo shows the teapot model twice, with one
                                                                     // teapot showing off the Fake_Bump_Map effect while the other has
                                                                     // regular texture and Phong lighting.
    constructor() {
        super();
        // Load the model file:
        this.shapes = {"house": new Shape_From_File("assets/House.obj")};

        this.materials = {
            house: new Material(new defs.Phong_Shader(),
                {ambient: .3, diffusity: .5, color: color(1,1,1,1)}),
        };

        // Don't create any DOM elements to control this scene:
        //this.widget_options = {make_controls: false};

    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        //this.key_triggered_button("", ["c"], );
        //this.key_triggered_button("", ["o"], () => {
        //});
    }

    display(context, program_state) {
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        let camera_matrix = Mat4.identity().times(Mat4.translation(1,0,-5))
            .times(Mat4.rotation(-45.25*Math.PI/2, 0, 1, 0))
            .times(Mat4.translation( -.8, 0, 0));

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(camera_matrix);
        }

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, .1, 1000);

        super.display(context, program_state);
        let model_transform = Mat4.identity();
        model_transform = model_transform.times(Mat4.scale(2,2,2));

        const t = program_state.animation_time;

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        // A spinning light to show off the bump map:
        program_state.lights = [new Light(vec4(3, 2, 10, 1), color(1, 1, 1, 1), 100000)];
        //const light_position = vec4(10, 10, 10, 1); //moved point position to origin (0,0,0)
        //program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        this.shapes.house.draw(context, program_state, model_transform,this.materials.house);

    }
}
//Define Main_Scene Class
const Main_Scene = MyScene;
const Additional_Scenes = [];

export {Main_Scene, Additional_Scenes, Canvas_Widget, Code_Widget, Text_Widget, defs}