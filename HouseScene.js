import {defs, tiny} from './examples/common.js';
// Pull these names into this module's scope for convenience:
const {
    Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene,
    Canvas_Widget, Code_Widget, Text_Widget
} = tiny;

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

export class HouseScene extends Scene {                           // **Obj_File_Demo** show how to load a single 3D model from an OBJ file.
    // Detailed model files can be used in place of simpler primitive-based
    // shapes to add complexity to a scene.  Simpler primitives in your scene
    // can just be thought of as placeholders until you find a model file
    // that fits well.  This demo shows the teapot model twice, with one
    // teapot showing off the Fake_Bump_Map effect while the other has
    // regular texture and Phong lighting.
    constructor() {
        super();
        // Load the model file:
        this.shapes = {
            "house": new Shape_From_File("assets/House.obj"),
            "ground": new Shape_From_File("assets/Ground.obj"),
            "bush": new Shape_From_File("assets/Bush.obj"),
            "leaves": new Shape_From_File("assets/Leaves.obj"),
            "trunk": new Shape_From_File("assets/Trunk.obj"),
            "stepstones": new Shape_From_File("assets/StepStones.obj")
        };

        this.materials = {
            house: new Material(new defs.Phong_Shader(),
                {ambient: .3, diffusity: .5, color: color(1, 1, 1, 1)}),
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
        let camera_matrix = Mat4.identity().times(Mat4.translation(1, 0, -6))
            .times(Mat4.rotation(-45.25 * Math.PI / 2, 0, 1, 0))
            .times(Mat4.translation(-.8, 0, 0));

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(camera_matrix);
        }

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, .1, 1000);

        super.display(context, program_state);
        let model_transform = Mat4.identity();
        model_transform = model_transform.times(Mat4.scale(1.5, 1.5, 1.5));

        const t = program_state.animation_time;

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        // A spinning light to show off the bump map:
        //program_state.lights = [new Light(vec4(3, 2, 10, 1), color(1, 1, 1, 1), 100000)];
        program_state.lights = [new Light(
            Mat4.rotation(t / 1000, 1, 0, 0).times(vec4(3, 2, 10, 1)),
            color(1, 1, 1, 1), 100000)];
        //const light_position = vec4(10, 10, 10, 1); //moved point position to origin (0,0,0)
        //program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // house
        this.shapes.house.draw(context, program_state, model_transform, this.materials.house);

        // ground
        let ground_transform = model_transform.times(Mat4.translation(0,-.6,0))
            .times(Mat4.scale(5, 5, 5));
        this.shapes.ground.draw(context, program_state, ground_transform, this.materials.house);

        // bush
        let bush_transform = model_transform.times(Mat4.translation(1,-.6,-.7))
            .times(Mat4.scale(.25, .25, .25));
        this.shapes.bush.draw(context, program_state, bush_transform, this.materials.house);

        // leaves
        let leaves_transform = model_transform.times(Mat4.translation(1.5,.7,1))
            .times(Mat4.rotation(2 * Math.PI / 2, 1, 0, 0))
            .times(Mat4.scale(.25, .25, .25));
        this.shapes.leaves.draw(context, program_state, leaves_transform, this.materials.house);

        // trunk
        let trunk_transform = model_transform.times(Mat4.translation(1.5,0,1))
            .times(Mat4.rotation(2 * Math.PI / 2, 1, 0, 0)).times(Mat4.scale(.7, .7, .7));
        this.shapes.trunk.draw(context, program_state, trunk_transform, this.materials.house);

        // stepstones
        let stepstones_transform = model_transform.times(Mat4.translation(1.5,-.58,0))
            .times(Mat4.scale(.3, .3, .3));
        this.shapes.stepstones.draw(context, program_state, stepstones_transform, this.materials.house);

    }
}