import * as THREE from 'three';

export function galaxyStarMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec3 color;
      attribute float size;
      uniform float pixelRatio;
      varying vec3 vColor;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float distance = max(1.0, -viewPosition.z);
        float apparent = clamp(450.0 / distance, .55, 3.5);
        gl_PointSize = clamp(size * apparent * pixelRatio, .65, 7.0 * pixelRatio);
        float fade = smoothstep(.4, 5.0, distance);
        vColor = color * fade * .48;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.0;
        if (r > 1.0) discard;
        float core = exp(-r * r * 8.0);
        float halo = exp(-r * r * 2.0) * .10;
        gl_FragColor = vec4(vColor, (core + halo) * (1.0-smoothstep(.75, 1.0, r)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending,
  });
}

export function galacticDustMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      varying vec2 vP;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vP = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float sum = 0.0, amplitude = .5;
        for (int i = 0; i < 5; i++) { sum += noise(p)*amplitude; p = mat2(.8,-.6,.6,.8)*p*2.03; amplitude *= .5; }
        return sum;
      }
      void main() {
        float r = length(vP);
        float edge = 1.0 - smoothstep(225.0, 285.0, r);
        if (edge < .001) discard;
        float theta = atan(vP.y, vP.x) - log(max(r, 42.0)/48.0)*3.4;
        float clouds = fbm(vP*.055);
        float filaments = fbm(vP*.28 + clouds*3.0);
        float major = pow(.5+.5*cos(2.0*theta + (clouds-.5)*.55), 14.0);
        float minor = pow(.5+.5*cos(2.0*theta+3.14159), 22.0)*.26;
        float arms = (major+minor) * smoothstep(30.0, 58.0, r);
        float disk = exp(-r/103.0) * (.22+arms*1.6);
        float bar = exp(-length(vP/vec2(41.0,12.0))*1.7);
        float bulge = exp(-dot(vP,vP)/420.0);
        float dustLane = pow(.5+.5*cos(2.0*(theta-.17)+(clouds-.5)*.7), 25.0);
        float dust = dustLane*smoothstep(25.0,60.0,r)*(.45+filaments*.9);
        float luminosity = (disk*(.12+pow(clouds,2.0)*3.8)+bar*.8+bulge*.3) * (1.0-dust*.88)*edge;
        vec3 color = mix(vec3(.51,.61,.8),vec3(1.0,.79,.53),clamp(bar*3.0+exp(-r/65.0),0.0,1.0));
        color = mix(color,vec3(.83,.51,.55),pow(filaments,5.0)*arms*.65);
        gl_FragColor = vec4(color * luminosity * 1.12, edge*.75);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
