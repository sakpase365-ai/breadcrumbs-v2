//
//  ContentView.swift
//  Breadcrumbs
//
//  Created by MANNA on 5/3/26.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        BreadcrumbsWebView(url: AppConfiguration.webAppRootURL)
            .ignoresSafeArea()
    }
}
