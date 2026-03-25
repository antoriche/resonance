#import <Capacitor/Capacitor.h>

CAP_PLUGIN(ResonanceRecorderPlugin, "ResonanceRecorder",
    CAP_PLUGIN_METHOD(startRecording, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopRecording, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(pauseRecording, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(resumeRecording, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getRecordingStatus, CAPPluginReturnPromise);
)
