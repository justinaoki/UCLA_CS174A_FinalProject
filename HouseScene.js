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


export class HouseScene extends Scene {

    constructor() {
        super();
        // Load the model file:
        this.num_particles = 1024;
        this.value = 0.0; //for heightmap
        this.intensity = 0.5; //for brick intensity
        this.speed_factor = 10000; //for speed
        this.time_direction = true; //for smooth animation
        this.shapes = {
            house: new Cube(),
            door: new Cube(),
            window: new Cube(),
            ground: new defs.Square(),
            "bush": new Shape_From_File("assets/Bush.obj"),
            "leaves": new Shape_From_File("assets/Leaves.obj"),
            "trunk": new Shape_From_File("assets/Trunk.obj"),
            "stepstones": new Shape_From_File("assets/StepStones.obj"),
            particles: new particles(this.num_particles),
            stone1: new defs.Capped_Cylinder(25,25),
            stone2: new defs.Capped_Cylinder(10,10)

        };
        this.materials = {

            bumpBrick: new Material(new defs.Bump(),
                {ambient: .7, diffusivity: .7, normal_scale: 0.5,
                    texture: new Texture("assets/BrickColor.png"),
                    texture2: new Texture("assets/BrickNormal.png")}),

            house: new Material(new BumpAndTextureLerp(), {
                growth_rate: this.value,
                normal_intensity: this.intensity,
                //color: hex_color("#ffffff"),
                ambient: .7, diffusivity: 0.5, //specularity: 0.8,
                texture: new Texture("assets/BrickColor.png"),
                texture2: new Texture("assets/GrassColor.png"),
                texture3: new Texture("assets/BrickDisplacement.png"),
                texture4: new Texture("assets/BrickNormal.png"),
                texture5: new Texture("assets/GrassNormal.png")
            }),
            door: new Material(new defs.Phong_Shader(),
                {ambient: .8, diffusivity: 0.1, specularity: 0.1, color: hex_color("#0D0F24"),}),
            ground: new Material(new defs.Bump(),
                {ambient: .8, diffusity: .5, color: color(0, 0, 0, 1),
                    texture: new Texture("assets/GrassColor.png"),
                    texture2: new Texture("assets/GrassNormal.png")}),
            stepstones: new Material(new defs.Textured_Phong(),
                {ambient: .8, diffusity: .5, color: color(0, 0, 0, 1),
                    texture: new Texture("assets/Ground.png")}),
            leaves: new Material(new defs.Textured_Phong(),
                {ambient: 1.0, diffusity: .5, color: color(0, 0, 0, 1),
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
        this.shapes.ground.arrays.texture_coord.forEach(v => v.scale_by(4));

        // Don't create any DOM elements to control this scene:
        //this.widget_options = {make_controls: false};

    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.

        this.key_triggered_button("Play/Pause", ["t"], () => {
                this.Animate ^= true;
            }
            ,"#87cefa" );
        this.new_line();
        this.key_triggered_button("-", ["5"], () => {
            if(!this.Animate && this.value >= 0.05) this.value -= .05;}
            ,"#0000ff" );
        this.live_string(box => {
            box.textContent = "|   Time:    " + this.value.toFixed(2) + "   |"
        }, );
        this.key_triggered_button("+", ["6"], () => {
            if(!this.Animate && this.value <= 1.0) this.value += .05;}
            ,"#0000ff" );
        this.new_line();
        this.key_triggered_button("-", ["7"], () => {
                if(this.speed_factor <= 100000) this.speed_factor += 500;}
            ,"#859ccc" );
        this.live_string(box => {
            box.textContent = "|   Speed:    " + ((1/this.speed_factor)*1000).toFixed(3) + "   |"
        }, );
        this.key_triggered_button("+", ["8"], () => {
                if(this.speed_factor >= 1500) this.speed_factor -= 500;}
            ,"#859ccc" );
        this.new_line();
        this.key_triggered_button("-", ["9"], () => {
                if(this.intensity >= 0.05) this.intensity -= .05;}
            ,"#5c9471" );
        this.live_string(box => {
            box.textContent = "|   Brick Lighting:    " + this.intensity.toFixed(2) + "   |"
        }, );
        this.key_triggered_button("+", ["0"], () => {
                if(this.intensity <= 1.0) this.intensity += .05;}
            ,"#5c9471" );
    }

    display(context, program_state) {
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        let camera_matrix = Mat4.identity().times(Mat4.translation(1, 0, -6))
            .times(Mat4.rotation(-45.35 * Math.PI / 2, 0, 1, 0))
            .times(Mat4.translation(-.8, 0, 0));

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);

        const light_position = vec4(0, 0, 10, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 100)];

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
        let speed = 1 / this.speed_factor;

        // animate
        if (this.Animate) {
            if (this.value >= 1)
                this.time_direction = false;
            else if (this.value <= 0)
                this.time_direction = true;
            if (this.time_direction)
                this.value += 50 / this.speed_factor;
            else
                this.value -= 50 / this.speed_factor;
        }
        // house
        let house_transform = model_transform.times(Mat4.scale(1, .5999, 1));
        this.shapes.house.draw(context, program_state, house_transform,
            this.materials.house.override({growth_rate: this.value, normal_intensity: this.intensity}));
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

        //stones
        let stone1_transform = model_transform.times(Mat4.translation(1.5, -0.59, 0.2))
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0))
            .times(Mat4.scale(.15, .15, .02));
        this.shapes.stone1.draw(context, program_state, stone1_transform, this.materials.stepstones);
        let stone2_transform = model_transform.times(Mat4.translation(2.0, -0.59, -0.1))
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0))
            .times(Mat4.scale(.1, .1, .02));
        this.shapes.stone1.draw(context, program_state, stone2_transform, this.materials.stepstones);
        let stone3_transform = model_transform.times(Mat4.translation(2.3, -0.59, 0.08))
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0))
            .times(Mat4.scale(.09, .09, .02));
        this.shapes.stone1.draw(context, program_state, stone3_transform, this.materials.stepstones);

        //stars
        let particle_model_transform = Mat4.identity()
            .times(Mat4.rotation(-45 * Math.PI / 2, 0, 1, 0))
            .times(Mat4.rotation(this.value * 2, 0, 0, 1));

        const offsets = Array(this.num_particles).fill(0).map(x=>vec3(0,0,0).randomized(.01));
        this.shapes.particles.arrays.offset = this.shapes.particles.arrays.offset.map((x, i)=> x.plus(offsets[~~(i/4)]));
        this.shapes.particles.draw(context, program_state, particle_model_transform, this.materials.particles);
        this.shapes.particles.copy_onto_graphics_card(context.context, ["offset"], false);
    }
}

class Texture_Lerp extends Textured_Phong {

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);

        context.uniform1i(gpu_addresses.texture2, 0);
        context.uniform1i(gpu_addresses.texture, 1);
        context.uniform1i(gpu_addresses.texture3, 2);
        material.texture2.activate(context, 0);
        material.texture.activate(context, 1);
        material.texture3.activate(context, 2);
    }


    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform sampler2D texture2;
            uniform sampler2D texture3;
            uniform float val;

            void main(){
                vec4 tex_color = texture2D( texture, f_tex_coord);
                vec4 tex2_color = texture2D( texture2, f_tex_coord );
                vec4 dispMap = texture2D(texture3, f_tex_coord);
                
                // TODO IMPLEMENT VAL BUTTON SIN WAVE
                val = 0.4;
                // -------------------------
                
                val = clamp( val, 0.0, 1.0 );
                val = 1.0 - val; // inverting
                val *= 2.0;
                
                dispMap = dispMap - 1.0;
                dispMap = dispMap + val;

                dispMap = clamp(dispMap,0.0,1.0);
                
                gl_FragColor = mix(tex2_color, tex_color, dispMap );
               
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                //gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}

class BumpAndTextureLerp extends Phong_Shader {

    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return ` precision mediump float;
                const int N_LIGHTS = ` + this.num_lights + `;
                uniform float ambient, diffusivity, specularity, smoothness;
                uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
                uniform float light_attenuation_factors[N_LIGHTS];
                uniform vec4 shape_color;
                uniform vec3 squared_scale, camera_center;
        
                // Specifier "varying" means a variable's final value will be passed from the vertex shader
                // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
                // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
                varying vec3 N, vertex_worldspace;
                vec3 L, H;
                // ***** PHONG SHADING HAPPENS HERE: *****                                       
                vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
                    // phong_model_lights():  Add up the lights' contributions.
                    vec3 E = normalize( camera_center - vertex_worldspace );
                    vec3 result = vec3( 0.0 );
                    for(int i = 0; i < N_LIGHTS; i++){
                        // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                        // light will appear directional (uniform direction from all points), and we 
                        // simply obtain a vector towards the light by directly using the stored value.
                        // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                        // the point light's location from the current surface point.  In either case, 
                        // fade (attenuate) the light as the vector needed to reach it gets longer.  
                        vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                                       light_positions_or_vectors[i].w * vertex_worldspace;                                             
                        float distance_to_light = length( surface_to_light_vector );
        
                        L = normalize( surface_to_light_vector );
                        H = normalize( L + E );
                        // Compute the diffuse and specular components from the Phong
                        // Reflection Model, using Blinn's "halfway vector" method:
                        float diffuse  =      max( dot( N, L ), 0.0 );
                        float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                        float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                        
                        vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                                  + light_colors[i].xyz * specularity * specular;
                        result += attenuation * light_contribution;
                      }
                    return result;
                  } `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                attribute vec3 position, normal;                            
                // Position is expressed in object coordinates.
                attribute vec2 texture_coord;
                
                uniform mat4 model_transform;
                uniform mat4 projection_camera_model_transform;
                uniform sampler2D texture;
                uniform sampler2D texture2;
 
                void main(){                                                                   
                    // The vertex's final resting place (in NDCS):
                    gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                    // The final normal vector in screen space.
                    N = normalize( mat3( model_transform ) * normal / squared_scale);
                    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                    // Turn the per-vertex texture coordinate into an interpolated variable.
                    f_tex_coord = texture_coord;
           
                    vec3 eyePosition = (model_transform *  gl_Position).xyz;
                    vec3 eyeLightPos = (model_transform * light_positions_or_vectors[0]).xyz;
                    vec3 T = normalize(vec3(1,0,0));
                    vec3 B = cross(N, T);
                    L.x = dot(T, eyeLightPos - eyePosition);
                    L.y = dot(B, eyeLightPos - eyePosition);
                    L.z = dot(N, eyeLightPos - eyePosition);
                    L = normalize(L);
                    
                  } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                uniform sampler2D texture;
                uniform sampler2D texture2;
                uniform sampler2D texture3;
                uniform sampler2D texture4;
                uniform sampler2D texture5;
                uniform float growth_rate;
                uniform float normal_intensity;
        
                void main(){
                    // Sample the texture image in the correct place:
                    vec4 tex_color = texture2D(texture, f_tex_coord);
                    vec4 tex2_color = texture2D(texture2, f_tex_coord);
                    vec4 dispMap = texture2D(texture3, f_tex_coord);
                    vec4 tex4_color = texture2D(texture4, f_tex_coord);
                    vec4 tex5_color = texture2D(texture5, f_tex_coord);
                    
                    float val = growth_rate;
                    
                    val = clamp( val, 0.0, 1.0 );
                    val = 1.0 - val; // inverting
                    val *= 2.0; 
                
                    dispMap = dispMap - 1.0;
                    dispMap = dispMap + val;

                    dispMap = clamp(dispMap,0.0,1.0);
                
                    gl_FragColor = mix(tex2_color, tex_color, dispMap);
                
                    float normal_scale = normal_intensity; 
                    normal_scale /= 2.0;
                    vec3 bumpN = normal_scale*normalize(N) - .5*vec3(1,1,1);
                    
                    //mix bumpN
                    if(growth_rate <= 0.75){
                        bumpN += tex4_color.rgb;
                    }else if(growth_rate <= 0.975){
                        bumpN += mix(tex4_color.rgb, tex5_color.rgb, (4.0*growth_rate) - 3.0);
                    }else{
                        bumpN += tex5_color.rgb;
                    }
                                                                      // Compute an initial (ambient) color:
                    //gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                             // Compute the final color with contributions from lights:
                    gl_FragColor.xyz += phong_model_lights( normalize( bumpN ), vertex_worldspace );
                  } `;
    }

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
        gl.uniform1f(gpu.growth_rate, material.growth_rate);
        gl.uniform1f(gpu.normal_intensity, material.normal_intensity);
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Add a little more to the base class's version of this method.
        super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);

        // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":

        context.uniform1i(gpu_addresses.texture2, 0);
        context.uniform1i(gpu_addresses.texture, 1);
        context.uniform1i(gpu_addresses.texture3, 2);
        context.uniform1i(gpu_addresses.texture4, 3);
        context.uniform1i(gpu_addresses.texture5, 4);
        // For this draw, use the texture image from correct the GPU buffer:
        material.texture2.activate(context, 0);
        material.texture.activate(context, 1);
        material.texture3.activate(context, 2);
        material.texture4.activate(context, 3);
        material.texture5.activate(context, 4);

        context.uniform1i(gpu_addresses.growth_rate, 5);
        context.uniform1i(gpu_addresses.normal_intensity, 6);

    }
}