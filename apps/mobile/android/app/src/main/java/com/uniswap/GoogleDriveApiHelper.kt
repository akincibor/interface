package com.uniswap

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.http.ByteArrayContent
import com.google.api.client.http.javanet.NetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.drive.Drive
import com.google.api.services.drive.DriveScopes
import com.google.api.services.drive.model.File
import com.google.api.services.drive.model.FileList
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.launch
import java.nio.charset.StandardCharsets
import java.util.Date

object GDriveParams {
  const val SPACES = "appDataFolder"
  const val FIELDS = "nextPageToken, files(id, name)"
  const val PAGE_SIZE_NORMAL = 30
  const val PAGE_SIZE_SINGLE = 1
}

/**
 * Helper class for Google Drive operations such as fetching and storing backups.
 */
class GoogleDriveApiHelper {
  companion object {

    val gson = Gson()

    /**
     * Returns a GoogleSignInClient object, which is needed to access Google Drive.
     *
     * @param reactContext The react application context.
     * @return GoogleSignInClient object
     * @throws IllegalStateException if the activity context is null.
     */
    fun getGoogleSignInClient(reactContext: ReactApplicationContext): GoogleSignInClient {
      val activity = reactContext.currentActivity
      if (activity != null) {
        val signInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
          .requestEmail()
          .requestScopes(Scope(DriveScopes.DRIVE_APPDATA))
          .build()
        return GoogleSignIn.getClient(activity, signInOptions)
      } else {
        throw IllegalStateException("Activity cannot be null")
      }
    }

    /**
     * Determines if the user has permission to Google Drive.
     *
     * @param reactContext The react application context.
     * @return A Boolean value indicating whether the user has permission.
     */
    fun hasPermissionToGoogleDrive(reactContext: ReactApplicationContext): Boolean {
      val acc = GoogleSignIn.getLastSignedInAccount(reactContext)
      val hasPermissions = acc?.let { GoogleSignIn.hasPermissions(acc, Scope(DriveScopes.DRIVE_APPDATA)) }
      return hasPermissions == true
    }

    /**
    * Fetches cloud backups from Google Drive and triggers corresponding events.
    *
    * @param drive The authenticated Drive object of Google Drive.
    * @param sendEvent Function to trigger a custom event.
    */
    suspend fun fetchCloudBackups(drive: Drive, sendEvent: (eventName: String, params: WritableMap?) -> Unit) {
      return withContext(Dispatchers.IO) {
        val files: FileList = drive.files().list()
          .setSpaces(GDriveParams.SPACES)
          .setFields(GDriveParams.FIELDS)
          .setPageSize(GDriveParams.PAGE_SIZE_NORMAL)
          .execute()


        files.files.forEach { file ->
          launch {
            val outputStream = ByteArrayOutputStream()
            drive.files()[file.id]
              .executeMediaAndDownloadTo(outputStream)
            val mnemonicsBackup: CloudStorageMnemonicBackup =
              gson.fromJson(outputStream.toString(), CloudStorageMnemonicBackup::class.java)
            val body: WritableMap = Arguments.createMap()
            body.putString("mnemonicId", mnemonicsBackup.mnemonicId)
            body.putString("createdAt", mnemonicsBackup.createdAt.toString())
            sendEvent(ICloudManagerEventType.FOUND_CLOUD_BACKUP.value, body)
          }
        }
      }
    }

    /**
     * Asynchronously retrieves an authenticated GoogleDrive object by gaining Google Drive permissions.
     *
     * @param reactContext The react application context.
     * @return An authenticated GoogleSignInAccount object.
     */
    suspend fun getGoogleDrivePermissions(reactContext: ReactApplicationContext): GoogleSignInAccount? =
      suspendCancellableCoroutine { continuation ->
        try {
          if (hasPermissionToGoogleDrive(reactContext)) {
            val account = GoogleSignIn.getLastSignedInAccount(reactContext)
            continuation.resumeWith(Result.success(account))
          } else {
            val googleSignInClient = getGoogleSignInClient(reactContext)
            val signInIntent = googleSignInClient.signInIntent
            reactContext.currentActivity?.startActivityForResult(
              signInIntent,
              Request.GOOGLE_SIGN_IN.value
            )
            reactContext.addActivityEventListener(object : ActivityEventListener {
              override fun onActivityResult(
                activity: Activity?,
                requestCode: Int,
                resultCode: Int,
                intent: Intent?
              ) {
                if (requestCode == Request.GOOGLE_SIGN_IN.value && resultCode == Activity.RESULT_OK) {
                  if (intent != null) {
                    val signInTask = GoogleSignIn.getSignedInAccountFromIntent(intent)
                    val account: GoogleSignInAccount? =
                      signInTask.getResult(ApiException::class.java)
                    continuation.resumeWith(Result.success(account))
                  } else {
                    Log.d("Activity intent", "Indent null")
                  }
                }
              }

              override fun onNewIntent(p0: Intent?) {}
            });
          }
        } catch (e: Exception) {
          Log.e("EXCEPTION", "${e.message}")
          continuation.resumeWith(Result.failure(
            Exception("Failed to get google drive account")
          ))
        }
      }

    /**
     * Asynchronously retrieves an authenticated Drive object.
     *
     * @param reactContext The react application context.
     * @return Google Drive object if user has permissions, `null` otherwise.
     */
    suspend fun getGoogleDrive(reactContext: ReactApplicationContext): Drive?{
      return withContext(Dispatchers.IO) {
        val account = getGoogleDrivePermissions(reactContext)
        account?.let {
          val credential =
            GoogleAccountCredential.usingOAuth2(reactContext, listOf(DriveScopes.DRIVE_APPDATA))
          credential.selectedAccount = account.account!!

          Drive
            .Builder(
              NetHttpTransport(),
              GsonFactory.getDefaultInstance(),
              credential
            )
            .setApplicationName(reactContext.getString(R.string.app_name))
            .build()
        }
      }
    }

    /**
     * Fetches the fileId of a file in Google Drive by its file name.
     * Assuming there is no bug in code, should always be only one file with the given name
     * even though google drive allows to store multiple files with the same name
     *
     * @param drive The authenticated Drive object of Google Drive.
     * @param name Name of the file.
     * @return String fileId if file exists, `null` otherwise.
     */
    fun getFileIdByFileName(drive: Drive, name: String): String? {
      try {
        val files: FileList = drive.files().list()
          .setSpaces(GDriveParams.SPACES)
          .setFields(GDriveParams.FIELDS)
          .setPageSize(GDriveParams.PAGE_SIZE_SINGLE)
          .setQ("name = '$name.json'")
          .execute()
        return files.files.firstOrNull()?.id
      } catch (e: Exception) {
        e.printStackTrace()
      }
      return null
    }

    /**
     * Uploads mnemonic backup to google drive in json formant
     *
     * @param drive The authenticated Drive object of Google Drive.
     * @param mnemonicId Id of saved mnemonic.
     * @param backup Instance of [CloudStorageMnemonicBackup] object representing mnemonic backup.
     * @return String fileId if file exists, `null` otherwise.
     */
    suspend fun saveMnemonicsToGoogleDrive(drive: Drive, mnemonicId: String, backup: CloudStorageMnemonicBackup) {
      val fileMetadata = File()
      fileMetadata.name = "$mnemonicId.json"
      fileMetadata.parents = listOf("appDataFolder")

      val jsonData = gson.toJson(backup)

      val jsonByteArray = jsonData.toByteArray(StandardCharsets.UTF_8)
      val inputContent = ByteArrayContent("application/json", jsonByteArray)
      val fileId = getFileIdByFileName(drive, mnemonicId)
      if (fileId != null) {
        drive.files().delete(fileId).execute()
      }
      drive.files().create(fileMetadata, inputContent)
        .execute()
    }
  }
}
