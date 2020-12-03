import {defs, tiny} from './common.js';
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

// ******************** End extra step

export class Plane extends Scene {                           // **Obj_File_Demo** show how to load a single 3D model from an OBJ file.
    // Detailed model files can be used in place of simpler primitive-based
    // shapes to add complexity to a scene.  Simpler primitives in your scene
    // can just be thought of as placeholders until you find a model file
    // that fits well.  This demo shows the teapot model twice, with one
    // teapot showing off the Fake_Bump_Map effect while the other has
    // regular texture and Phong lighting.
    constructor() {
        super();
        // Load the model file:
        this.shapes = {"plane": new Shape_From_File("assets/plane1.obj"),
            plane2: new defs.Square()
        };
        this.shapes.plane2.arrays.texture_coord.forEach(v => v.scale_by(2));

        this.materials = {
            plane: new Material(new defs.Phong_Shader(),
                {ambient: .3, diffusity: .5, color: color(1,1,1,1)}),
            stars: new Material(new defs.Textured_Phong(1), {
                //color: color(.5, .5, .5, 1),
                ambient: .3, diffusivity: .5, specularity: .5, texture: new Texture("assets/stars.png")}),
            bump: new Material(new defs.Bump(),
                {ambient: .3, diffusivity: .5, specularity: .5, texture: new Texture("assets/stars.png")}),

            brick: new Material(new defs.Textured_Phong(), {
                ambient: .3, diffusivity: .7, texture: new Texture("assets/BrickColor.png")}),

            bumpBrick: new Material(new defs.Bump(),
                {ambient: .3, diffusivity: .7, texture: new Texture("assets/BrickColor.png")}),

            grass: new Material(new defs.Textured_Phong(1), {
                ambient: .3, diffusivity: .7, texture: new Texture("assets/GrassColor.png")}),

            bumpGrass: new Material(new defs.Bump(),
                {ambient: .3, diffusivity: .7, texture: new Texture("assets/GrassColor.png")}),
        };

        // Don't create any DOM elements to control this scene:
        //this.widget_options = {make_controls: false};

    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        //this.key_triggered_button("", ["c"], );
        //this.key_triggered_button("", ["o"], () => {
        //});
        this.key_triggered_button("Pause", ["c"], () => {}
            ,"#87cefa" );
        this.new_line();
        this.key_triggered_button("-", ["a"], () => {}
        ,"#0000ff" );
        this.live_string(box => {
            box.textContent = "|    Time:    |"
        }, );
        this.key_triggered_button("+", ["b"], () => {}
            ,"#0000ff" );
    }

    display(context, program_state) {
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:

        let camera_matrix_plane = Mat4.identity().times(Mat4.translation(0,0,-5.0));
        let model_transform_plane = Mat4.identity();
        //LIGHTING
        const light_position_plane = vec4(0, 0, 10, 1);
        program_state.lights = [new Light(light_position_plane, color(1, 1, 1, 1), 100)];

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(camera_matrix_plane);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        model_transform_plane = model_transform_plane.times(Mat4.translation(-0.5,0,0));
        this.shapes.plane2.draw(context, program_state, model_transform_plane, this.materials.bumpBrick);

        model_transform_plane = model_transform_plane.times(Mat4.translation(2,0,0));
        this.shapes.plane2.draw(context,program_state, model_transform_plane, this.materials.brick);
    }
}