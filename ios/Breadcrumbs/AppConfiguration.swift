//
//  AppConfiguration.swift
//  Breadcrumbs
//
//  Points the embedded web app at your deployed Next.js site (or local dev server).
//

import Foundation

enum AppConfiguration {
    /// Root URL of the Breadcrumbs web app (no trailing slash).
    ///
    /// - **Release / TestFlight:** set to your Netlify (or other) HTTPS URL.
    /// - **Debug:** defaults to local Next.js; use the simulator, or on a physical device
    ///   enable *App Transport Security → Allow Local Networking* in Xcode for `http://localhost`.
    static var webAppRootURL: URL {
        #if DEBUG
        // Simulator: `npm run dev` on the same Mac. Device: use your machine's LAN IP + port, or production URL.
        URL(string: "http://127.0.0.1:3000")!
        #else
        URL(string: "https://breadcrumbs-v2.vercel.app")!
        #endif
    }
}
