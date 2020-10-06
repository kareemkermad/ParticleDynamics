// Plane, Particle, Scene classes
export class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static randomUnit() {
        var theta = Math.random() * Math.PI * 2;
        return new Vector2(Math.cos(theta), Math.sin(theta));
    }

    static zero() {
        return new Vector2(0.0, 0.0);
    }
    
    static add(a, b) {
        return new Vector2(a.x + b.x, a.y + b.y);
    }

    static subtract(a, b) {
        return new Vector2(a.x - b.x, a.y - b.y);
    }

    static scale(a, k) {
        return new Vector2(k * a.x, k * a.y);
    }

    static dot(a, b) {
        return a.x * b.x + a.y * b.y;
    }

    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    magnitudeSq() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        return Vector2.scale(this, 1.0 / this.magnitude());
    }

    orthogonal() {
        return new Vector2(-this.y, this.x);
    }

    rotate(theta) {
        return new Vector2(this.x * Math.cos(theta) - this.y * Math.sin(theta), this.x * Math.sin(theta) + this.y * Math.cos(theta));
    }
}

export class Spring {
    constructor(p1, p2, r, ks, kd) {
        this.p1 = p1;
        this.p2 = p2;
        this.r = r;
        this.ks = ks;
        this.kd = kd;
    }

    static atRest(p1, p2, ks, kd) {
        return new Spring(p1, p2, Vector2.subtract(p1.position, p2.position).magnitude(), ks, kd);
    }
}

export class Particle {
    constructor(position, velocity, radius, invmass, dragCoefficient, material) {
        this.position = position;
        this.velocity = velocity;
        this.force = Vector2.zero(); // accumulated force
        this.radius = radius;
        this.invmass = invmass; // inverse mass
        this.dragCoefficient = dragCoefficient;
        this.material = material;
    }
}

export class Plane {
    constructor(normal, origin, material) {
        this.normal = normal; // must be a unit normal.
        this.origin = origin;
        this.material = material;
    }

    static fromAngle(theta, origin, material) {
        return new Plane(new Vector2(Math.cos(theta), Math.sin(theta)), origin, material);
    }
}

export class Scene {
    constructor() {
        this.planes = [];
        this.particles = [];
        this.springs = [];
        this.restitutionMatrix = []; // row-major lower triangular matrix
        this.frictionMatrix = []; // row-major lower triangular matrix
        this.materialCount = 0;
        this.gravity = new Vector2(0.0, -9.81);
        this.density = 1.2; // kg/m^3
        this.thresholdCollisionSpeedSq = 0.001;
        this.thresholdFrictionSpeedSq = 1e-6;
    }

    addMaterial() {
        // The next row of the lower triangular matrix will have 1 more element than the current row 
        for (let i = 0; i < this.materialCount + 1; i++) {
            this.restitutionMatrix.push(0);
            this.frictionMatrix.push(0);
        }
        return this.materialCount++;
    }

    setRestitution(m1, m2, e) {
        this.restitutionMatrix[this.matrixIndex(m1, m2)] = e;
    }

    setFriction(m1, m2, kf) {
        this.frictionMatrix[this.matrixIndex(m1, m2)] = kf;
    }

    matrixIndex(m1, m2) {
        if (m1 >= m2) {
            return m2 + m1 * (m1 + 1) / 2;
        }
        return m1 + m2 * (m2 + 1) / 2;
    }

    applyCollision() {
        // Particle-Plane Collision
        this.particles.forEach(particle => {
            this.planes.forEach(plane => {
                var distance = Vector2.dot(plane.normal, Vector2.subtract(particle.position, plane.origin)); // The perpendicular distance from a point, p to the plane, r.n = a.n is given by: d = n.(p - a)
                var penetration = particle.radius - distance;
                if (penetration >= -0.001) {
                    // Projection to remove penetration.
                    particle.position = Vector2.add(particle.position, Vector2.scale(plane.normal, penetration));

                    // Collision/Contact Detection
                    var dot_v = Vector2.dot(plane.normal, particle.velocity);
                    var v_n = Vector2.scale(plane.normal, dot_v);
                    var v_t = Vector2.subtract(particle.velocity, v_n);
                    
                    if (dot_v < 0.0 && v_n.magnitudeSq() > this.thresholdCollisionSpeedSq) {
                        // Collision Response
                        var e = this.restitutionMatrix[this.matrixIndex(particle.material, plane.material)]
                        particle.velocity = Vector2.subtract(v_t, Vector2.scale(v_n, e));
                    }
                    else {
                        // Contact Response
                        var dot_f = Vector2.dot(plane.normal, particle.force);
                        if (dot_f < 0.0) {
                            // Zero the velocity in the direction normal to the plane
                            particle.velocity = v_t;

                            // Apply a contact force since the particle is being pushed into the plane
                            particle.force = Vector2.subtract(particle.force, Vector2.scale(plane.normal, dot_f));

                            // Apply a frictional force
                            if (v_t.magnitudeSq() > this.thresholdFrictionSpeedSq) {
                                var kf = this.frictionMatrix[this.matrixIndex(particle.material, plane.material)];
                                particle.force = Vector2.add(particle.force, Vector2.scale(v_t.normalize(), kf * dot_f));
                            }
                            else {
                                particle.velocity = Vector2.zero();
                            }
                        }
                    }
                }
            });
        });

        // TODO: particle-particle collision
    }

    applyGravity() {
        this.particles.forEach(particle => {
            if (particle.invmass > 0) {
                particle.force = Vector2.add(particle.force, Vector2.scale(this.gravity, 1.0 / particle.invmass));
            }
        });
    }

    applyDrag() {
        this.particles.forEach(particle => {
            var area = Math.PI * particle.radius * particle.radius;
            var velocitySq = new Vector2(particle.velocity.x * particle.velocity.x * Math.sign(particle.velocity.x), particle.velocity.y * particle.velocity.y * Math.sign(particle.velocity.y));
            var fd = Vector2.scale(velocitySq, 0.5 * particle.dragCoefficient * this.density * area);
            particle.force = Vector2.subtract(particle.force, fd);
        });
    }

    applySprings() {
        this.springs.forEach(spring => {
            var p1 = spring.p1;
            var p2 = spring.p2;

            var l = Vector2.subtract(p1.position, p2.position);
            var ldot = Vector2.subtract(p1.velocity, p2.velocity);
            var lnorm = l.magnitude();
            var lunit = (lnorm > 0) ? Vector2.scale(l, 1.0 / lnorm) : Vector2.randomUnit();

            var k = spring.ks * (lnorm - spring.r) + spring.kd * Vector2.dot(ldot, lunit);
            var fb = Vector2.scale(lunit, k);

            p1.force = Vector2.subtract(p1.force, fb);
            p2.force = Vector2.add(p2.force, fb);
        });
    }

    applyForces() {
        // TODO: apply drag, friction, collision, spring
        this.applyGravity();
        this.applyDrag();
        this.applySprings();
        this.applyCollision();
    }

    clearForces() {
        this.particles.forEach(particle => {
            particle.force = Vector2.zero();
        });
    }

    eulerStep(dt) { 
        this.particles.forEach(particle => {
            particle.velocity = Vector2.add(particle.velocity, Vector2.scale(particle.force, dt * particle.invmass));
            particle.position = Vector2.add(particle.position, Vector2.scale(particle.velocity, dt));
        });
    }

    step(dt) {
        this.clearForces();
        this.applyForces();
        this.eulerStep(dt);
    }
}