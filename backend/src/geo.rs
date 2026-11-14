use serde::{Deserialize, Serialize};

/// A point as sent by the frontend: `[lat, lng]`.
pub type LatLng = [f64; 2];

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point {
    pub lat: f64,
    pub lng: f64,
}

/// Centroid as the mean of the vertices (good enough for farm-sized polygons).
pub fn centroid(poly: &[LatLng]) -> Point {
    let n = poly.len().max(1) as f64;
    let (lat, lng) = poly
        .iter()
        .fold((0.0, 0.0), |(a, b), p| (a + p[0], b + p[1]));
    Point { lat: lat / n, lng: lng / n }
}

/// Polygon area in hectares using a local equirectangular projection.
pub fn area_ha(poly: &[LatLng]) -> f64 {
    if poly.len() < 3 {
        return 0.0;
    }
    let c = centroid(poly);
    let r = 6_371_008.8_f64;
    let k = c.lat.to_radians().cos();
    let xy: Vec<(f64, f64)> = poly
        .iter()
        .map(|p| {
            (
                (p[1] - c.lng).to_radians() * r * k,
                (p[0] - c.lat).to_radians() * r,
            )
        })
        .collect();
    let mut s = 0.0;
    for i in 0..xy.len() {
        let (x1, y1) = xy[i];
        let (x2, y2) = xy[(i + 1) % xy.len()];
        s += x1 * y2 - x2 * y1;
    }
    (s.abs() / 2.0) / 10_000.0
}

pub fn valid_polygon(poly: &[LatLng]) -> bool {
    poly.len() >= 3
        && poly
            .iter()
            .all(|p| p[0].is_finite() && p[1].is_finite() && p[0].abs() <= 90.0 && p[1].abs() <= 180.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn demo_farm_is_about_120_ha() {
        let poly = crate::DEMO_POLYGON;
        let a = area_ha(&poly);
        assert!((100.0..140.0).contains(&a), "area was {a}");
    }
}
