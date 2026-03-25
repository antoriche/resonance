import UIKit
import Capacitor

class ResonanceViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ResonanceRecorderPlugin())
    }
}
