import {defs, tiny} from './examples/common.js';
// Pull these names into this module's scope for convenience:
const {
    Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene,
    Canvas_Widget, Code_Widget, Text_Widget, hex_color,
} = tiny;
const {Cube, Axis_Arrows, Textured_Phong, Triangle, Phong_Shader} = defs

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

const particles = defs.particles =
    class particles extends Shape {

        constructor(num_particles) {
            super("position", "normal", "texture_coord", "offset");
            for(let i = 0; i < num_particles; i++){
                defs.Square.insert_transformed_copy_into(this, [9], Mat4.identity());
            }
            const offsets = Array(num_particles).fill(0).map(x=>vec3(0,0,0).randomized(50));
            this.arrays.offset = this.arrays.position.map((x, i)=> offsets[~~(i/4)]);
        }
    }

const Particle_Phong = defs.Particle_Phong =
    class Particle_Phong extends Phong_Shader {
        // **Textured_Phong** is a Phong Shader extended to addditionally decal a
        // texture image over the drawn shape, lined up according to the texture
        // coordinates that are stored at each shape vertex.
        vertex_glsl_code() {
            // ********* VERTEX SHADER *********
            return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                attribute vec3 position, normal, offset;
                                         
                // Position is expressed in object coordinates.
                attribute vec2 texture_coord;
                
                uniform mat4 model_transform;
                uniform mat4 projection_camera_model_transform;
        
                void main(){   
                    vec3 temp = offset;
                    temp[2] = mod(temp[2], 4.0)+5.0;                                                                
                    // The vertex's final resting place (in NDCS):
                    gl_Position = projection_camera_model_transform * vec4( position+temp, 1.0 );
                    // The final normal vector in screen space.
                    N = normalize( mat3( model_transform ) * normal / squared_scale);
                    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                    // Turn the per-vertex texture coordinate into an interpolated variable.
                    f_tex_coord = texture_coord;
                  } `;
        }

        fragment_glsl_code() {
            // ********* FRAGMENT SHADER *********
            // A fragment is a pixel that's overlapped by the current triangle.
            // Fragments affect the final image or get discarded due to depth.
            return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                uniform sampler2D texture;
                uniform float animation_time;
                
                void main(){
                    // Sample the texture image in the correct place:
                    vec4 tex_color = vec4(0.01/(distance(f_tex_coord, vec2(.5,.5)))-0.2);
                    if( tex_color.w < .01 ) discard;
                                                                             // Compute an initial (ambient) color:
                    gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                             // Compute the final color with contributions from lights:
                    gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
                  } `;
        }

        update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
            // update_GPU(): Add a little more to the base class's version of this method.
            super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
            // Updated for assignment 4
            context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
            if (material.texture && material.texture.ready) {
                // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
                context.uniform1i(gpu_addresses.texture, 0);
                // For this draw, use the texture image from correct the GPU buffer:
                material.texture.activate(context);
            }
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
        this.num_particles = 1024;
        this.shapes = {
            house: new Cube(),
            door: new Cube(),
            window: new Cube(),
            //"house": new Shape_From_File("assets/House.obj"),
            //"ground": new Shape_From_File("assets/Ground.obj"),
            ground: new defs.Square(),
            "bush": new Shape_From_File("assets/Bush.obj"),
            "leaves": new Shape_From_File("assets/Leaves.obj"),
            "trunk": new Shape_From_File("assets/Trunk.obj"),
            "stepstones": new Shape_From_File("assets/StepStones.obj"),
            particles: new particles(this.num_particles)
        };
        this.materials = {
            house: new Material(new defs.Textured_Phong(),
                {ambient: .8, diffusity: .5, color: color(0, 0, 0, 1),
                    texture: new Texture("assets/BrickColor.png")}),
            door: new Material(new defs.Phong_Shader(),
                {ambient: .8, diffusivity: 0.1, specularity: 0.1, color: hex_color("#000000"),}),
            ground: new Material(new defs.Textured_Phong(),
                {ambient: .8, diffusity: .5, color: color(0, 0, 0, 1),
                    texture: new Texture("assets/Ground.png")}),
            leaves: new Material(new defs.Textured_Phong(),
                {ambient: .8, diffusity: .5, color: color(0, 0, 0, 1),
                    texture: new Texture("assets/Leaves.png")}),
            trunk: new Material(new defs.Textured_Phong(),
                {ambient: .8, diffusity: .5, color: color(0, 0, 0, 1),
                    texture: new Texture("assets/Trunk.png")}),
            particles: new Material(new Particle_Phong(), {
                color: color(1,1,1,1),
                ambient: .5, diffusity: 0.1, specularity: 0.1,
                texture: new Texture("assets/stars.png")
            })
        };

        // Don't create any DOM elements to control this scene:
        //this.widget_options = {make_controls: false};

    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        //this.key_triggered_button("", ["c"], );
        //this.key_triggered_button("", ["o"], () => {
        //});
        this.key_triggered_button("Pause", ["c"], () => {
                this.Pause^=true;
            }
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
        model_transform = model_transform.times(Mat4.scale(1.4, 1.5, 1.4));

        const t = program_state.animation_time;
        let time = t/1000;

        if(this.Pause){
            time = 0;
        }

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        // A spinning light to show off the bump map:
        //program_state.lights = [new Light(vec4(3, 2, 10, 1), color(1, 1, 1, 1), 100000)];
        program_state.lights = [new Light(
            Mat4.rotation(t / 1000, 1, 0, 0).times(vec4(3, 2, 10, 1)),
            color(1, 1, 1, 1), 100000)];
        //const light_position = vec4(10, 10, 10, 1); //moved point position to origin (0,0,0)
        //program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // house
        let house_transform = model_transform.times(Mat4.scale(1, .5999, 1));
        this.shapes.house.draw(context, program_state, house_transform, this.materials.house);
        let door_transform = model_transform.times(Mat4.translation(1,-.2999,.4))
            .times(Mat4.scale(.04, .3, .15));
        this.shapes.door.draw(context, program_state, door_transform, this.materials.door);
        let window_transform = model_transform.times(Mat4.translation(1,.15,-.4))
            .times(Mat4.scale(.04, .15, .15));
        this.shapes.window.draw(context, program_state, window_transform, this.materials.door);

        // ground
        let ground_transform = model_transform.times(Mat4.translation(0,-.6,0))
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))
            .times(Mat4.scale(5, 5, 5));
        this.shapes.ground.draw(context, program_state, ground_transform, this.materials.ground);

        // bush
        let bush_transform = model_transform.times(Mat4.translation(1,-.6,-.7))
            .times(Mat4.scale(.25, .25, .25));
        this.shapes.bush.draw(context, program_state, bush_transform, this.materials.leaves);

        // leaves
        let leaves_transform = model_transform.times(Mat4.translation(1.5,.7,1))
            .times(Mat4.rotation(2 * Math.PI / 2, 1, 0, 0))
            .times(Mat4.scale(.25, .25, .25));
        this.shapes.leaves.draw(context, program_state, leaves_transform, this.materials.leaves);

        // trunk
        let trunk_transform = model_transform.times(Mat4.translation(1.5,0,1))
            .times(Mat4.rotation(2 * Math.PI / 2, 1, 0, 0)).times(Mat4.scale(.7, .6, .7));
        this.shapes.trunk.draw(context, program_state, trunk_transform, this.materials.trunk);

        // stepstones
        let stepstones_transform = model_transform.times(Mat4.translation(1.5,-.58,0))
            .times(Mat4.scale(.3, .27, .3));
        this.shapes.stepstones.draw(context, program_state, stepstones_transform, this.materials.ground);

        //stars
        let particle_model_transform = Mat4.identity()
            .times(Mat4.rotation(-45 * Math.PI / 2, 0, 1, 0))
            .times(Mat4.rotation(time, 0, 0, 1));

        const offsets = Array(this.num_particles).fill(0).map(x=>vec3(0,0,0).randomized(.01));
        this.shapes.particles.arrays.offset = this.shapes.particles.arrays.offset.map((x, i)=> x.plus(offsets[~~(i/4)]));
        this.shapes.particles.draw(context, program_state, particle_model_transform, this.materials.particles);
        this.shapes.particles.copy_onto_graphics_card(context.context, ["offset"], false);

    }
}