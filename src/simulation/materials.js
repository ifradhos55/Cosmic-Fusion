import * as THREE from 'three';

const worldVertex = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    // normalMatrix accounts for any scaling. Bring the view-space normal back
    // to world space so a rotating camera cannot rotate the sunlight or rim.
    vWorldNormal = normalize(vec3(vec4(normalMatrix * normal, 0.0) * viewMatrix));
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export function createAtmosphere(color, strength = .7) {
  return new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) }, strength: { value: strength } },
    vertexShader: worldVertex,
    fragmentShader: /* glsl */`
      uniform vec3 glowColor;
      uniform float strength;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(-vWorldPosition);
        float limb = pow(1.0 - abs(dot(normal, viewDirection)), 3.1);
        float daylight = smoothstep(-0.3, 0.65, dot(normal, lightDirection));
        float alpha = limb * (0.1 + daylight * 0.9) * strength;
        gl_FragColor = vec4(glowColor * (1.1 + daylight * .6), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Neutral sunlight, restrained albedo, and a true dark hemisphere. */
export function createPlanetMaterial(surfaceMap, id = 'moon') {
  const ice = id === 'uranus' || id === 'neptune';
  return new THREE.ShaderMaterial({
    uniforms: {
      surfaceMap: { value: surfaceMap },
      saturation: { value: id === 'venus' ? .18 : id === 'mars' ? .78 : .82 },
      recolor: { value: ice ? .94 : 0 },
      tint: { value: new THREE.Color(id === 'neptune' ? '#91b6be' : '#a0c2c3') },
      ringMap: { value: surfaceMap }, hasRings: { value: 0 },
      ringCenter: { value: new THREE.Vector3() }, ringNormal: { value: new THREE.Vector3(0, 1, 0) },
      planetRadius: { value: 1 },
    },
    vertexShader: worldVertex,
    fragmentShader: /* glsl */`
      uniform sampler2D surfaceMap;
      uniform float saturation;
      uniform float recolor;
      uniform vec3 tint;
      uniform sampler2D ringMap;
      uniform float hasRings;
      uniform vec3 ringCenter;
      uniform vec3 ringNormal;
      uniform float planetRadius;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 albedo = texture2D(surfaceMap, vUv).rgb;
        float luminance = dot(albedo, vec3(.2126,.7152,.0722));
        albedo = mix(vec3(luminance), albedo, saturation);
        // Old Neptune maps exaggerate blue to reveal weather. Preserve their
        // spatial detail while approximating the observed pale blue-green hue.
        albedo = mix(albedo, tint * (.82 + luminance*.48), recolor);
        vec3 n = normalize(vWorldNormal), light = normalize(-vWorldPosition);
        float incidence = max(dot(n, light), 0.0);
        float ringShadow = 1.0;
        float denominator = dot(light, ringNormal);
        if (hasRings > .5 && abs(denominator) > .001) {
          float t = dot(ringCenter-vWorldPosition,ringNormal)/denominator;
          float radius = length(vWorldPosition + light*t - ringCenter)/planetRadius;
          if (t > .0 && radius > 1.24 && radius < 2.27) {
            ringShadow = 1.0 - texture2D(ringMap,vec2((radius-1.24)/1.03,.5)).a*.87;
          }
        }
        vec3 color = albedo * (.012 + incidence*1.2*ringShadow);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Earth day/night terminator, ocean reflections, and surface relief. */
export function createEarthMaterial(dayMap, nightMap, bumpMap) {
  return new THREE.ShaderMaterial({
    uniforms: { dayMap: { value: dayMap }, nightMap: { value: nightMap }, bumpMap: { value: bumpMap }, hasBump: { value: 0 } },
    vertexShader: worldVertex,
    fragmentShader: /* glsl */`
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D bumpMap;
      uniform float hasBump;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normal = normalize(vWorldNormal);
        float bump = texture2D(bumpMap, vUv).r;
        vec3 q0 = dFdx(vWorldPosition);
        vec3 q1 = dFdy(vWorldPosition);
        vec3 r1 = cross(q1, normal);
        vec3 r2 = cross(normal, q0);
        float determinant = dot(q0, r1);
        vec3 gradient = sign(determinant) * (dFdx(bump) * r1 + dFdy(bump) * r2);
        normal = normalize(abs(determinant) * normal - gradient * .012 * hasBump);
        vec3 lightDirection = normalize(-vWorldPosition);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float incidence = dot(normal, lightDirection);
        float diffuse = max(incidence, 0.0);
        float day = smoothstep(-.12, .16, incidence);
        vec3 surface = texture2D(dayMap, vUv).rgb;
        vec3 night = texture2D(nightMap, vUv).rgb;
        float ocean = smoothstep(.012, .085, surface.b - surface.r) * (1.0 - smoothstep(.18, .7, surface.r));
        float specular = pow(max(dot(reflect(-lightDirection, normal), viewDirection), 0.0), 65.0) * ocean * day;
        float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 4.0);
        vec3 color = surface * (.014 + diffuse * 1.2);
        color += night * (1.0 - smoothstep(-.18, .08, incidence)) * .85;
        color += vec3(.7, .85, 1.0) * specular * .65;
        color += vec3(.025, .12, .26) * fresnel * day * .6;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createSunMaterial(surfaceMap) {
  return new THREE.ShaderMaterial({
    uniforms: { surfaceMap: { value: surfaceMap }, time: { value: 0 } },
    vertexShader: worldVertex,
    fragmentShader: /* glsl */`
      uniform sampler2D surfaceMap;
      uniform float time;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec2 uv = vUv + vec2(sin(vUv.y * 60.0 + time * .13) * .0008, 0.0);
        vec3 surface = texture2D(surfaceMap, uv).rgb;
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float facing = max(dot(normalize(vWorldNormal), viewDirection), 0.0);
        float granulation = .68 + surface.r * .65;
        float limbDarkening = .45 + .55 * pow(facing, .5);
        vec3 color = vec3(1.0, .94, .83) * granulation * limbDarkening * 1.7;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createRingMaterial(map, planetRadius) {
  return new THREE.ShaderMaterial({
    uniforms: { ringMap: { value: map }, planetCenter: { value: new THREE.Vector3() }, planetRadius: { value: planetRadius } },
    vertexShader: worldVertex,
    fragmentShader: /* glsl */`
      uniform sampler2D ringMap;
      uniform vec3 planetCenter;
      uniform float planetRadius;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec4 ring = texture2D(ringMap, vec2(vUv.x, .5));
        if (ring.a < .015) discard;
        vec3 toSun = normalize(-vWorldPosition);
        vec3 toPlanet = planetCenter - vWorldPosition;
        float projection = dot(toPlanet, toSun);
        float distanceToAxis = length(toPlanet - toSun * projection);
        float shadow = projection > 0.0 ? smoothstep(planetRadius * .98, planetRadius * 1.06, distanceToAxis) : 1.0;
        float diffuse = .58 + .6 * abs(dot(normalize(vWorldNormal), toSun));
        gl_FragColor = vec4(ring.rgb * diffuse * (.14 + shadow * .86), ring.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  });
}
