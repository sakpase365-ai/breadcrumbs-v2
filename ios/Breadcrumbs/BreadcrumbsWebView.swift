//
//  BreadcrumbsWebView.swift
//  Breadcrumbs
//
//  Full-screen WKWebView wrapper for the existing Next.js + Supabase web app.
//

import SwiftUI
import WebKit

struct BreadcrumbsWebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true
        webView.isInspectable = true

        context.coordinator.webView = webView
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        weak var webView: WKWebView?

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let requestURL = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            // Let target=_blank / window.open work inside the same webview.
            if navigationAction.targetFrame == nil {
                webView.load(URLRequest(url: requestURL))
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }
    }
}
