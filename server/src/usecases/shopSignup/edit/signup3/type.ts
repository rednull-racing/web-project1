export type UploadedS3Object = {
    bucketName: string;
    objectKey: string;
    etag: string | null;
    versionId: string | null;
};

export type UploadedObject =
    | (UploadedS3Object & {
          type: "idCardFront";
          originalFileName: string;
          contentType: string;
          fileSize: number;
      })
    | (UploadedS3Object & {
          type: "idCardRear";
          originalFileName: string;
          contentType: string;
          fileSize: number;
      })
    | (UploadedS3Object & {
          type: "permit";
          originalFileName: string;
          contentType: string;
          fileSize: number;
          sortOrder: number;
      });
