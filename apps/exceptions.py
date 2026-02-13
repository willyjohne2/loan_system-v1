from rest_framework.exceptions import APIException


class InsufficientCapitalError(APIException):
    status_code = 400
    default_detail = "Insufficient system capital to complete this disbursement."
    default_code = "insufficient_capital"
