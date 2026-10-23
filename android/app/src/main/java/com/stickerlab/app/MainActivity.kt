package com.stickerlab.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.stickerlab.app.whatsapp.WhatsAppStickersPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Los plugins propios se registran antes de crear el puente
        registerPlugin(WhatsAppStickersPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
